import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Media, MediaType } from './entities/media.entity';
import { ConfigService } from '@nestjs/config';
import { ProductImage } from '../products/entities/product-image.entity';
import { BadRequestException } from '@nestjs/common';

// Mock S3 Client
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

// Mock S3 Presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.com/test.jpg'),
}));

// Mock Sharp
const mockSharpInstance = {
  resize: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-buffer-data')),
};
jest.mock('sharp', () => jest.fn(() => mockSharpInstance));

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin123',
      S3_BUCKET: 'ecommerce-media',
      S3_REGION: 'us-east-1',
      S3_FORCE_PATH_STYLE: 'true',
      CDN_DOMAIN: 'https://cdn.example.com',
    };
    return config[key];
  }),
});

describe('MediaService', () => {
  let service: MediaService;
  let mediaRepo: ReturnType<typeof mockRepository>;
  let productImageRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: getRepositoryToken(Media), useValue: mockRepository() },
        {
          provide: getRepositoryToken(ProductImage),
          useValue: mockRepository(),
        },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    mediaRepo = module.get(getRepositoryToken(Media));
    productImageRepo = module.get(getRepositoryToken(ProductImage));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadImage', () => {
    const mockFile = (mimetype: string, size: number): Express.Multer.File => ({
      fieldname: 'file',
      originalname: 'test.png',
      encoding: '7bit',
      mimetype,
      size,
      buffer: Buffer.from('original-buffer'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    });

    it('should throw BadRequestException if file is not an image', async () => {
      const file = mockFile('application/pdf', 1000);
      await expect(service.uploadImage(file)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file is too large', async () => {
      const file = mockFile('image/png', 6 * 1024 * 1024); // 6MB
      await expect(service.uploadImage(file)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if sharp fails', async () => {
      const file = mockFile('image/png', 1000);
      jest.spyOn(mockSharpInstance, 'toBuffer').mockRejectedValueOnce(new Error('Sharp processing error'));

      await expect(service.uploadImage(file)).rejects.toThrow(BadRequestException);
    });

    it('should successfully upload single image without product ID', async () => {
      const file = mockFile('image/png', 1000);
      const mockSavedMedia = {
        id: 'media-id',
        originalName: 'test.png',
        fileName: 'products/mock-file.webp',
        mimeType: 'image/webp',
        url: 'https://cdn.example.com/products/mock-file.webp',
        type: MediaType.IMAGE,
        size: 1000,
      };

      mediaRepo.create.mockReturnValue(mockSavedMedia);
      mediaRepo.save.mockResolvedValue(mockSavedMedia);

      const result = await service.uploadImage(file);

      expect(mediaRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        originalName: 'test.png',
        mimeType: 'image/webp',
        type: MediaType.IMAGE,
      }));
      expect(mediaRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockSavedMedia);
    });

    it('should successfully upload single image with product ID (first image, should be primary)', async () => {
      const file = mockFile('image/png', 1000);
      const mockSavedMedia = {
        id: 'media-id',
        originalName: 'test.png',
        fileName: 'products/mock-file.webp',
        mimeType: 'image/webp',
        url: 'https://cdn.example.com/products/mock-file.webp',
        type: MediaType.IMAGE,
        size: 1000,
        productId: 'product-id',
      };

      mediaRepo.create.mockReturnValue(mockSavedMedia);
      mediaRepo.save.mockResolvedValue(mockSavedMedia);
      productImageRepo.count.mockResolvedValue(0);

      const result = await service.uploadImage(file, 'product-id');

      expect(productImageRepo.count).toHaveBeenCalledWith({ where: { productId: 'product-id' } });
      expect(productImageRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        productId: 'product-id',
        isPrimary: true,
        sortOrder: 0,
      }));
      expect(productImageRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockSavedMedia);
    });

    it('should successfully upload single image with product ID (subsequent image, not primary)', async () => {
      const file = mockFile('image/png', 1000);
      const mockSavedMedia = {
        id: 'media-id',
        productId: 'product-id',
      };

      mediaRepo.create.mockReturnValue(mockSavedMedia);
      mediaRepo.save.mockResolvedValue(mockSavedMedia);
      productImageRepo.count.mockResolvedValue(2);

      await service.uploadImage(file, 'product-id');

      expect(productImageRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        productId: 'product-id',
        isPrimary: false,
        sortOrder: 2,
      }));
    });
  });

  describe('uploadMultipleImages', () => {
    const mockFile = (originalname: string): Express.Multer.File => ({
      fieldname: 'file',
      originalname,
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1000,
      buffer: Buffer.from('original-buffer'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    });

    it('should throw BadRequestException if files array is empty or undefined', async () => {
      await expect(service.uploadMultipleImages([])).rejects.toThrow(BadRequestException);
      await expect(service.uploadMultipleImages(null as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if files array exceeds 5', async () => {
      const files = [
        mockFile('1.png'),
        mockFile('2.png'),
        mockFile('3.png'),
        mockFile('4.png'),
        mockFile('5.png'),
        mockFile('6.png'),
      ];
      await expect(service.uploadMultipleImages(files)).rejects.toThrow(BadRequestException);
    });

    it('should upload multiple images successfully', async () => {
      const files = [mockFile('1.png'), mockFile('2.png')];
      const mockSavedMedia = { id: 'media-id' };
      mediaRepo.create.mockReturnValue(mockSavedMedia);
      mediaRepo.save.mockResolvedValue(mockSavedMedia);

      const result = await service.uploadMultipleImages(files, 'product-id');

      expect(result).toHaveLength(2);
      expect(mediaRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteImage', () => {
    it('should throw BadRequestException if media is not found', async () => {
      mediaRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteImage('invalid-id')).rejects.toThrow(BadRequestException);
    });

    it('should delete media from S3 and DB (no product ID)', async () => {
      const media = { id: 'media-uuid', fileName: 'test.jpg' };
      mediaRepo.findOne.mockResolvedValue(media);

      const result = await service.deleteImage('media-uuid');

      expect(mediaRepo.remove).toHaveBeenCalledWith(media);
      expect(result).toEqual({ message: 'Media deleted successfully' });
    });

    it('should delete media and remove product image if product ID is present', async () => {
      const media = {
        id: 'media-uuid',
        fileName: 'test.jpg',
        productId: 'product-id',
        url: 'https://cdn.example.com/test.jpg',
      };
      mediaRepo.findOne.mockResolvedValue(media);

      const mockProductImage = { id: 'product-image-id' };
      productImageRepo.findOne.mockResolvedValue(mockProductImage);

      await service.deleteImage('media-uuid');

      expect(productImageRepo.findOne).toHaveBeenCalledWith({
        where: { productId: 'product-id', url: 'https://cdn.example.com/test.jpg' },
      });
      expect(productImageRepo.remove).toHaveBeenCalledWith(mockProductImage);
      expect(mediaRepo.remove).toHaveBeenCalledWith(media);
    });
  });

  describe('getSignedUrl', () => {
    it('should return signed URL from S3 Client', async () => {
      const url = await service.getSignedUrl('products/test.webp', 3600);
      expect(url).toBe('https://signed-url.com/test.jpg');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { ConfigService } from '@nestjs/config';

// Mock S3 Client
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      'S3_ENDPOINT': 'http://localhost:9000',
      'S3_ACCESS_KEY': 'minioadmin',
      'S3_SECRET_KEY': 'minioadmin123',
      'S3_BUCKET': 'ecommerce-media',
      'S3_REGION': 'us-east-1',
      'S3_FORCE_PATH_STYLE': 'true',
    };
    return config[key];
  }),
});

describe('MediaService', () => {
  let service: MediaService;
  let mediaRepo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: getRepositoryToken(Media), useValue: mockRepository() },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    mediaRepo = module.get(getRepositoryToken(Media));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deleteImage', () => {
    it('should delete media', async () => {
      const media = { id: 'media-uuid', fileName: 'test.jpg' };
      mediaRepo.findOne.mockResolvedValue(media);
      mediaRepo.remove.mockResolvedValue(undefined);

      await service.deleteImage('media-uuid');  // ← No esperar retorno

      expect(mediaRepo.remove).toHaveBeenCalled();  // ← Verificar que se llamó
    });
  });
});
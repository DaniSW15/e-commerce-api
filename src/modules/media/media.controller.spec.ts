import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';

describe('MediaController', () => {
  let controller: MediaController;
  let service: jest.Mocked<any>;

  beforeEach(async () => {
    const mockMediaService = {
      uploadMultipleImages: jest.fn(),
      deleteImage: jest.fn(),
      getSignedUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: mockMediaService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MediaController>(MediaController);
    service = module.get(MediaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('should call service.uploadMultipleImages', async () => {
      const files = [{ originalname: 'file1.jpg' }] as any[];
      service.uploadMultipleImages.mockResolvedValueOnce([{ id: 'm-1' }]);

      const result = await controller.upload(files, 'prod-1');
      expect(result).toEqual([{ id: 'm-1' }]);
      expect(service.uploadMultipleImages).toHaveBeenCalledWith(
        files,
        'prod-1',
      );
    });
  });

  describe('delete', () => {
    it('should call service.deleteImage', async () => {
      service.deleteImage.mockResolvedValueOnce({ message: 'ok' });

      const result = await controller.delete('m-1');
      expect(result).toEqual({ message: 'ok' });
      expect(service.deleteImage).toHaveBeenCalledWith('m-1');
    });
  });

  describe('getSignedUrl', () => {
    it('should call service.getSignedUrl and return metadata', async () => {
      service.getSignedUrl.mockResolvedValueOnce('http://signed-url');

      const result = await controller.getSignedUrl('key-1', 3600);
      expect(result).toEqual({
        url: 'http://signed-url',
        expiresIn: 3600,
        key: 'key-1',
      });
      expect(service.getSignedUrl).toHaveBeenCalledWith('key-1', 3600);
    });
  });
});

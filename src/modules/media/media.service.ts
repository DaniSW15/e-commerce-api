import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Media, MediaType } from './entities/media.entity';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class MediaService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get('S3_REGION'),
      endpoint: this.configService.get('S3_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get('S3_ACCESS_KEY'),
        secretAccessKey: this.configService.get('S3_SECRET_KEY'),
      },
      forcePathStyle: this.configService.get('S3_FORCE_PATH_STYLE') === 'true',
    });

    this.bucket = this.configService.get('S3_BUCKET');
  }

  async uploadImage(file: Express.Multer.File, productId?: string): Promise<Media> {
    // Validaciones
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only images allowed');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Max 5MB');
    }

    // Procesar imagen
    const processed = await sharp(file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Generar nombre único
    const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;

    // Subir a MinIO/S3
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileName,
      Body: processed,
      ContentType: 'image/webp',
      Metadata: {
        'original-name': file.originalname,
      },
    }));

    // Guardar en DB
    const media = this.mediaRepository.create({
      originalName: file.originalname,
      fileName,
      mimeType: 'image/webp',
      url: `${this.configService.get('CDN_DOMAIN')}/${fileName}`,
      type: MediaType.IMAGE,
      size: processed.length,
      productId,
    });

    return this.mediaRepository.save(media);
  }

  async deleteImage(id: string): Promise<{ message: string }> {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) throw new BadRequestException('Media not found');

    // Eliminar de S3
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: media.fileName,
    }));

    // Eliminar de DB
    await this.mediaRepository.remove(media);

    return { message: 'Media deleted successfully' };
  }

  async getSignedUrl(fileName: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileName,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}

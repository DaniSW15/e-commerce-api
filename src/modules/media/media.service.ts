import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Media, MediaType } from './entities/media.entity';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ProductImage } from '../products/entities/product-image.entity';

@Injectable()
export class MediaService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
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

  async uploadImage(
    file: Express.Multer.File,
    productId?: string,
  ): Promise<Media> {
    return this.uploadSingleImage(file, productId);
  }

  async uploadMultipleImages(
    files: Express.Multer.File[],
    productId?: string,
  ): Promise<Media[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 5) {
      throw new BadRequestException('Max 5 files allowed');
    }

    const uploadPromises = files.map((file) =>
      this.uploadSingleImage(file, productId),
    );
    return Promise.all(uploadPromises);
  }

  private async uploadSingleImage(
    file: Express.Multer.File,
    productId?: string,
  ): Promise<Media> {
    // Validaciones
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        `Only images allowed. Invalid file: ${file.originalname}`,
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException(
        `Max 5MB. File too large: ${file.originalname}`,
      );
    }

    // Procesar imagen
    let processed: Buffer;
    try {
      processed = await sharp(file.buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to process image ${file.originalname}: ${err.message}`,
      );
    }

    // Generar nombre único
    const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;

    // Subir a MinIO/S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
        Body: processed,
        ContentType: 'image/webp',
        Metadata: {
          'original-name': file.originalname,
        },
      }),
    );

    const url = `${this.configService.get('CDN_DOMAIN')}/${fileName}`;

    // Guardar en DB (Media table)
    const media = this.mediaRepository.create({
      originalName: file.originalname,
      fileName,
      mimeType: 'image/webp',
      url,
      type: MediaType.IMAGE,
      size: processed.length,
      productId,
    });

    const savedMedia = await this.mediaRepository.save(media);

    // Si productId es provisto, también guardamos en la tabla product_images
    if (productId) {
      const currentImagesCount = await this.productImageRepository.count({
        where: { productId },
      });

      const productImage = this.productImageRepository.create({
        url,
        productId,
        altText: file.originalname.split('.')[0],
        sortOrder: currentImagesCount,
        isPrimary: currentImagesCount === 0,
      });

      await this.productImageRepository.save(productImage);
    }

    return savedMedia;
  }

  async deleteImage(id: string): Promise<{ message: string }> {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) throw new BadRequestException('Media not found');

    // Eliminar de S3
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: media.fileName,
      }),
    );

    // Si tiene productId, eliminar también de la tabla product_images por URL
    if (media.productId) {
      const productImage = await this.productImageRepository.findOne({
        where: { productId: media.productId, url: media.url },
      });
      if (productImage) {
        await this.productImageRepository.remove(productImage);
      }
    }

    // Eliminar de DB
    await this.mediaRepository.remove(media);

    return { message: 'Media deleted successfully' };
  }

  async getSignedUrl(
    fileName: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileName,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}

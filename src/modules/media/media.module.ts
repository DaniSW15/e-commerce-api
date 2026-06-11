import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { AuthModule } from '../auth/auth.module';
import { ProductImage } from '../products/entities/product-image.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Media, ProductImage]), AuthModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}

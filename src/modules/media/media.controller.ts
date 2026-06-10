import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { UserRole } from '@/common/enums';
import { Multer } from 'multer';

@ApiTags('media')
@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SELLER)
@ApiBearerAuth('JWT-auth')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: any,
    @Body('productId') productId?: string,
  ) {
    return this.mediaService.uploadImage(file, productId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete image' })
  async delete(@Param('id') id: string) {
    return this.mediaService.deleteImage(id);
  }

  @Get(':key/signed-url')
  @ApiOperation({ summary: 'Get signed URL for media file' })
  async getSignedUrl(
    @Param('key') key: string,
    @Query('expiresIn', new ParseIntPipe({ optional: true }))
    expiresIn?: number,
  ) {
    const url = await this.mediaService.getSignedUrl(key, expiresIn);
    return {
      url,
      expiresIn: expiresIn || 3600,
      key,
    };
  }
}

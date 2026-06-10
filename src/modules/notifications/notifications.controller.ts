import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendEmailDto } from './dto/send-email.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { UserRole } from '@/common/enums';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('email')
  @ApiOperation({ summary: 'Send email (queued)' })
  async sendEmail(@Body() dto: SendEmailDto) {
    return this.notificationsService.sendEmail(dto);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get notification status' })
  async getStatus(@Param('id') id: string) {
    return this.notificationsService.getStatus(id);
  }
}

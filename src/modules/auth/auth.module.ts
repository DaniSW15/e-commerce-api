import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { RefreshToken } from './entites/refresh-token.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategry';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { TwoFactorGuard } from './guards/two-factor.guard';
import { PasswordReset } from './entites/password-reset.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [
    SharedModule,
    forwardRef(() => UsersModule),
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken, PasswordReset]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    RefreshTokenStrategy,
    TwoFactorGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, PermissionsGuard],
})
export class AuthModule {}

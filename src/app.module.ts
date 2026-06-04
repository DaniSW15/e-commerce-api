import { Module } from '@nestjs/common';
import { UsersModule } from '@modules/users/users.module';
import { AuthModule } from '@modules/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@modules/users/entities/user.entity';
import { UserProfile } from '@modules/users/entities/user-profile.entity';
import { UserAddress } from '@modules/users/entities/user-address.entity';
import { LoginAttempt } from '@modules/users/entities/login-attempt.entity';
import { RefreshToken } from '@modules/auth/entites/refresh-token.entity';
import { PasswordReset } from '@modules/auth/entites/password-reset.entity';
import { UserSubscriber } from '@modules/users/subscribers/user.subscriber';
import { RedisService } from './common/services/redis/redis.service';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'password'),
        database: configService.get<string>('DB_NAME', 'ecommerce_dev'),
        entities: [
          User,
          UserProfile,
          UserAddress,
          LoginAttempt,
          RefreshToken,
          PasswordReset,
        ],
        subscribers: [UserSubscriber],
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        logging: configService.get<string>('DB_LOGGING') === 'true',
      }),
      inject: [ConfigService],
    }),
    SharedModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [],
  providers: [RedisService],
})
export class AppModule { }

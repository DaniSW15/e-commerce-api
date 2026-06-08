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
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './modules/products/products.module';
import { Product } from './modules/products/entities/product.entity';
import { Category } from './modules/products/entities/category.entity';
import { ProductImage } from './modules/products/entities/product-image.entity';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MediaModule } from './modules/media/media.module';
import { BullModule } from '@nestjs/bull';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CartModule } from './modules/cart/cart.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL', 60000),      // 60 segundos
            limit: config.get('THROTTLE_LIMIT', 100),     // 100 requests por IP
          },
        ],
      }),
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'password'),
        database: configService.get<string>('DB_NAME', 'ecommerce_dev'),
        autoLoadEntities: true,
        subscribers: [UserSubscriber],
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        logging: configService.get<string>('DB_LOGGING') === 'true',
        // ✅ SINTAXIS CORRECTA - objeto, no string
        invalidWhereValuesBehavior: {
          null: 'sql-null',
          undefined: 'throw',
        },
      }),
      inject: [ConfigService],
    }),
    SharedModule,
    UsersModule,
    AuthModule,
    HealthModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    MediaModule,
    NotificationsModule,
    CartModule,
  ],
  controllers: [],
  providers: [RedisService,
    {
      provide: 'APP_GUARD',
      useClass: ThrottlerGuard
    }
  ],
})
export class AppModule { }

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserAddress } from './entities/user-address.entity';
import { UserSubscriber } from './subscribers/user.subscriber';
import { LoginAttempt } from './entities/login-attempt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserProfile, UserAddress, LoginAttempt])],
  controllers: [UsersController],
  providers: [UsersService, UserSubscriber],
  exports: [UsersService]
})
export class UsersModule {}

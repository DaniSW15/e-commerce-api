import { Module } from '@nestjs/common';
import { UsersController } from '@users/users.controller';
import { UsersService } from '@users/users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@users/entities/user.entity';
import { UserProfile } from '@users/entities/user-profile.entity';
import { UserAddress } from '@users/entities/user-address.entity';
import { UserSubscriber } from '@users/subscribers/user.subscriber';
import { LoginAttempt } from '@users/entities/login-attempt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserProfile, UserAddress, LoginAttempt])],
  controllers: [UsersController],
  providers: [UsersService, UserSubscriber],
  exports: [UsersService, TypeOrmModule]
})
export class UsersModule {}

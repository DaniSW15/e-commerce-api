import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  listenTo() {
    return User;
  }

  private isAlreadyHashed(password: string): boolean {
    return (
      password.startsWith('$2a$') ||
      password.startsWith('$2b$') ||
      password.startsWith('$2y$')
    );
  }

  async beforeInsert(event: InsertEvent<User>) {
    console.log('🔐 UserSubscriber.beforeInsert - Hasheando contraseña...');
    if (event.entity.password && !this.isAlreadyHashed(event.entity.password)) {
      const salt = await bcrypt.genSalt(10);
      event.entity.password = await bcrypt.hash(event.entity.password, salt);
      console.log(
        '✅ Contraseña hasheada para el usuario:',
        event.entity.email,
      );
    }
  }

  async beforeUpdate(event: UpdateEvent<User>) {
    const entity = event.entity as User;

    if (
      entity &&
      entity.password &&
      !this.isAlreadyHashed(entity.password) &&
      entity.password !== event.databaseEntity?.password
    ) {
      const salt = await bcrypt.genSalt(10);
      entity.password = await bcrypt.hash(entity.password, salt);
      console.log('✅ Contraseña hasheada para el usuario:', entity.email);
    }
  }
}

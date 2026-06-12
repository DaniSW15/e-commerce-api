import { UserSubscriber } from './user.subscriber';
import { User } from '../entities/user.entity';
import { InsertEvent, UpdateEvent } from 'typeorm';
import * as bcrypt from 'bcrypt';

describe('UserSubscriber', () => {
  let subscriber: UserSubscriber;

  beforeEach(() => {
    subscriber = new UserSubscriber();
  });

  it('should be defined', () => {
    expect(subscriber).toBeDefined();
  });

  it('should listen to User entity', () => {
    expect(subscriber.listenTo()).toBe(User);
  });

  describe('beforeInsert', () => {
    it('should hash the password if it exists', async () => {
      const mockUser = {
        email: 'test@example.com',
        password: 'plainpassword',
      } as User;

      const event = {
        entity: mockUser,
      } as InsertEvent<User>;

      await subscriber.beforeInsert(event);

      expect(mockUser.password).not.toBe('plainpassword');
      const isMatch = await bcrypt.compare('plainpassword', mockUser.password);
      expect(isMatch).toBe(true);
    });

    it('should do nothing if password does not exist', async () => {
      const mockUser = {
        email: 'test@example.com',
      } as User;

      const event = {
        entity: mockUser,
      } as InsertEvent<User>;

      await subscriber.beforeInsert(event);
      expect(mockUser.password).toBeUndefined();
    });
  });

  describe('beforeUpdate', () => {
    it('should hash the password if it changed', async () => {
      const mockUser = {
        email: 'test@example.com',
        password: 'newplainpassword',
      } as User;

      const event = {
        entity: mockUser,
        databaseEntity: {
          password: 'oldhashedpassword',
        },
      } as unknown as UpdateEvent<User>;

      await subscriber.beforeUpdate(event);

      expect(mockUser.password).not.toBe('newplainpassword');
      const isMatch = await bcrypt.compare(
        'newplainpassword',
        mockUser.password,
      );
      expect(isMatch).toBe(true);
    });

    it('should do nothing if password is not changed', async () => {
      const mockUser = {
        email: 'test@example.com',
        password: 'samepassword',
      } as User;

      const event = {
        entity: mockUser,
        databaseEntity: {
          password: 'samepassword',
        },
      } as unknown as UpdateEvent<User>;

      await subscriber.beforeUpdate(event);
      expect(mockUser.password).toBe('samepassword');
    });

    it('should do nothing if entity is undefined', async () => {
      const event = {
        entity: undefined,
      } as unknown as UpdateEvent<User>;

      await expect(subscriber.beforeUpdate(event)).resolves.not.toThrow();
    });
  });
});

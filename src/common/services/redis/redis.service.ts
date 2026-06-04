import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
    private readonly redis: Redis;

    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            db: parseInt(process.env.REDIS_DB || '0'),
        });
    }

    async get(key: string): Promise<string | null> {
        return this.redis.get(key);
    }

    async setex(key: string, seconds: number, value: string): Promise<void> {
        await this.redis.setex(key, seconds, value);
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }
}
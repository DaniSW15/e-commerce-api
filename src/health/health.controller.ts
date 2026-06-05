import { RedisService } from '@/common/services/redis/redis.service';
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private db: TypeOrmHealthIndicator,
        private memory: MemoryHealthIndicator,
        private redisService: RedisService,
    ) { }


    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.db.pingCheck('database'),
            () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
            () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB
            () => this.redisCheck(),
        ]);
    }

    private async redisCheck(): Promise<HealthIndicatorResult> {
        try {
            await this.redisService.get('health:check');
            return { redis: { status: 'up' } } as HealthIndicatorResult;
        } catch (error) {
            return { redis: { status: 'down' } } as HealthIndicatorResult;
        }
    }
}

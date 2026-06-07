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
        // Leer thresholds de env, 0 = desactivado
        const heapThreshold = process.env.HEALTH_MEMORY_HEAP_THRESHOLD 
            ? Number(process.env.HEALTH_MEMORY_HEAP_THRESHOLD) 
            : 150 * 1024 * 1024;
        const rssThreshold = process.env.HEALTH_MEMORY_RSS_THRESHOLD 
            ? Number(process.env.HEALTH_MEMORY_RSS_THRESHOLD) 
            : 300 * 1024 * 1024;

        const checks: (() => Promise<HealthIndicatorResult>)[] = [
            () => this.db.pingCheck('database'),
        ];

        // Solo verificar Redis si no estamos en test environment
        if (process.env.NODE_ENV !== 'test') {
            checks.push(() => this.redisCheck());
        }

        // Solo agregar memory checks si threshold > 0
        if (heapThreshold > 0) {
            checks.push(() => this.memory.checkHeap('memory_heap', heapThreshold));
        }
        if (rssThreshold > 0) {
            checks.push(() => this.memory.checkRSS('memory_rss', rssThreshold));
        }

        return this.health.check(checks);
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
import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import compression from 'compression';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

const winstonLogger = WinstonModule.createLogger({
  instance: winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      isProduction
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              ({ timestamp, level, message, context, ...meta }) => {
                const contextStr = context ? ` [${context}]` : '';
                const metaStr = Object.keys(meta).length
                  ? ` ${JSON.stringify(meta)}`
                  : '';
                return `${timestamp} ${level}${contextStr}: ${message}${metaStr}`;
              },
            ),
          ),
    ),
    transports: [new winston.transports.Console()],
  }),
});

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const startTime = Date.now();

  logger.log('Creating NestJS application...');
  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  const configService = app.get(ConfigService);
  const port = Number(configService.get('PORT', 3000));
  const apiPrefix = configService.get('API_PREFIX', '/api/v1');
  const nodeEnv = configService.get('NODE_ENV', 'development');

  // ==================== GLOBAL PIPES ====================
  logger.log('Configuring global validation pipe...');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: nodeEnv === 'production', // No exponer detalles en prod
    }),
  );

  // ==================== SECURITY ====================
  logger.log('Configuring security middlewares...');

  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const allowedOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir peticiones sin Origin (curl, apps móviles, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Orígenes por defecto en desarrollo (Angular 4200 y React/Next 3000)
      const isDev = nodeEnv !== 'production';
      const devDefaults = ['http://localhost:3000', 'http://localhost:4200'];

      const whitelist =
        allowedOrigins.length > 0 ? allowedOrigins : isDev ? devDefaults : [];

      // En producción no permitimos wildcard (*) si credentials es true
      const hasWildcard = whitelist.includes('*');
      if (hasWildcard && !isDev) {
        logger.warn(
          'WARNING: CORS wildcard (*) is not allowed in production with credentials enabled!',
        );
        return callback(
          new Error('CORS wildcard not allowed in production with credentials'),
        );
      }

      if (whitelist.includes(origin) || (isDev && hasWildcard)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  });

  app.use(compression());

  // ==================== REQUEST TRACING ====================
  app.use((req: any, res: any, next: () => void) => {
    req.requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  // ==================== GLOBAL PREFIX ====================
  app.setGlobalPrefix(apiPrefix);

  // ==================== SWAGGER ====================
  if (nodeEnv !== 'production') {
    logger.log('Setting up Swagger documentation...');
    const swaggerConfig = new DocumentBuilder()
      .setTitle('E-Commerce API')
      .setDescription('Enterprise-grade e-commerce platform API')
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT-auth',
      )
      .addServer(`http://localhost:${port}`, 'Local Development')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
        tagsSorter: 'alpha',
      },
    });
  }

  // ==================== GRACEFUL SHUTDOWN ====================
  app.enableShutdownHooks();

  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`${signal} received. Shutting down gracefully...`);
      await app.close();
      logger.log('Graceful shutdown completed');
      process.exit(0);
    });
  });

  // ==================== START ====================
  await app.listen(port);

  const bootTime = Date.now() - startTime;
  logger.log(`✅ Server ready in ${bootTime}ms`);
  logger.log(`🌐 http://localhost:${port}${apiPrefix}`);

  if (nodeEnv !== 'production') {
    logger.log(`📚 Swagger: http://localhost:${port}${apiPrefix}/docs`);
  }
}

bootstrap().catch((err) => {
  logger.error('Failed to start application', err.stack);
  process.exit(1);
});

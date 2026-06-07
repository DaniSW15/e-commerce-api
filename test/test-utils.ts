import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

export async function createTestApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('/api/v1');
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        })
    );

    await app.init();
    return app;
}

/**
 * Verifica el email de un usuario en el entorno de test
 */
export async function verifyUserEmail(app: INestApplication, email: string): Promise<void> {
    const dataSource = app.get(DataSource);
    await dataSource.query(`
        UPDATE users SET "emailVerified" = true WHERE email = $1
    `, [email]);
}
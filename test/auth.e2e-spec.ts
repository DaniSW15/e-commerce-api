import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
    let app: INestApplication;
    let accessToken: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('/auth/register (POST) - should register user', () => {
        return request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
                role: 'customer',
            })
            .expect(201)
            .expect((res) => {
                expect(res.body.user.email).toBe('test@example.com');
            });
    });

    it('/auth/login (POST) - should login', () => {
        return request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123',
            })
            .expect(200)
            .expect((res) => {
                expect(res.body.accessToken).toBeDefined();
                accessToken = res.body.accessToken;
            });
    });

    it('/auth/me (GET) - should get current user', () => {
        return request(app.getHttpServer())
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200)
            .expect((res) => {
                expect(res.body.email).toBe('test@example.com');
            });
    });
});
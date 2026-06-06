import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('ProductsController (e2e)', () => {
    let app: INestApplication;
    let accessToken: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        // Login as admin
        const res = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'admin@example.com',
                password: 'admin123',
            });

        accessToken = res.body.accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    it('/products (POST) - should create product', () => {
        return request(app.getHttpServer())
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                sku: 'SKU-TEST-001',
                name: 'Test Product',
                slug: 'test-product',
                price: 99.99,
                stockQuantity: 100,
            })
            .expect(201)
            .expect((res) => {
                expect(res.body.name).toBe('Test Product');
            });
    });

    it('/products (GET) - should list products', () => {
        return request(app.getHttpServer())
            .get('/api/v1/products')
            .expect(200)
            .expect((res) => {
                expect(res.body.data).toBeDefined();
                expect(res.body.meta).toBeDefined();
            });
    });
});
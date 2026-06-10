import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, verifyUserEmail } from './test-utils';

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  const adminEmail = `admin-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await createTestApp();

    // 1. Registrar admin
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: adminEmail,
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    });

    // Verificar email en entorno de test
    await verifyUserEmail(app, adminEmail);

    // 2. Login como admin
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: adminEmail,
        password: 'admin123',
      });

    if (loginRes.status !== 200) {
      console.log('Admin login failed:', loginRes.status, loginRes.body);
      throw new Error(`Admin login failed: ${loginRes.body.message}`);
    }

    accessToken = loginRes.body.access_token;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  }, 10000);

  it('/products (POST) - should create product', () => {
    return request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sku: `SKU-${Date.now()}`,
        name: 'Test Product',
        slug: `test-product-${Date.now()}`,
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

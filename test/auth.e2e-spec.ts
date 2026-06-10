import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, verifyUserEmail } from './test-utils';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  const testEmail = `test-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  }, 10000);

  it('/auth/register (POST) - should register user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'customer',
      });

    console.log('Register response:', res.status, res.body);
    expect(res.status).toBe(201);

    // Verificar email para permitir login en tests
    await verifyUserEmail(app, testEmail);
  });

  it('/auth/login (POST) - should login', async () => {
    // DEBUG: Ver qué pasa exactamente
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'password123',
      });

    console.log('Login response:', res.status, res.body);

    // Si falla, intentar verificar email primero si hay endpoint
    if (res.status === 401) {
      console.log('Login failed - checking if email verification needed');
    }

    expect(res.status).toBe(200);
    accessToken = res.body.access_token;
  });

  it('/auth/me (GET) - should get current user', async () => {
    if (!accessToken) {
      throw new Error('No access token');
    }

    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    console.log('Me response:', res.status, res.body);
    expect(res.status).toBe(200);
  });
});

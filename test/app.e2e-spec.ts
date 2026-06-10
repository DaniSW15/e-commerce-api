import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-utils';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  }, 10000);

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });
});

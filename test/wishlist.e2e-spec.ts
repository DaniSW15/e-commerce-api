import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, verifyUserEmail } from './test-utils';
import { DataSource } from 'typeorm';
import {
  Product,
  ProductStatus,
} from '../src/modules/products/entities/product.entity';
import { Category } from '../src/modules/products/entities/category.entity';

describe('WishlistController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let customerToken: string;
  let productId: string;
  const customerEmail = `wishlist-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    // 1. Registrar y loguear cliente
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: customerEmail,
      password: 'password123',
      firstName: 'Wishlist',
      lastName: 'User',
      role: 'customer',
    });
    await verifyUserEmail(app, customerEmail);
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: customerEmail,
        password: 'password123',
      });
    customerToken = loginRes.body.access_token;

    // 2. Crear categoría y producto
    const cat = await dataSource.getRepository(Category).save({
      name: 'Books',
      slug: `books-${Date.now()}`,
      description: 'Books category',
    });

    const prod = await dataSource.getRepository(Product).save({
      sku: `SKU-WISH-${Date.now()}`,
      name: 'Novel',
      slug: `novel-${Date.now()}`,
      price: 14.99,
      stockQuantity: 20,
      status: ProductStatus.ACTIVE,
      categoryId: cat.id,
    });
    productId = prod.id;
  }, 30000);

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query('TRUNCATE TABLE "wishlist_products" CASCADE');
      await dataSource.query('TRUNCATE TABLE "wishlists" CASCADE');
      await dataSource.query('TRUNCATE TABLE "products" CASCADE');
      await dataSource.query('TRUNCATE TABLE "categories" CASCADE');
      await dataSource.query('TRUNCATE TABLE "users" CASCADE');
    }
    if (app) await app.close();
  }, 15000);

  it('should manage product wishlist (add, get, remove)', async () => {
    // 1. Obtener wishlist vacía
    const emptyRes = await request(app.getHttpServer())
      .get('/api/v1/wishlist')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(emptyRes.body.products).toHaveLength(0);

    // 2. Añadir producto a la wishlist
    const addRes = await request(app.getHttpServer())
      .post(`/api/v1/wishlist/products/${productId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(addRes.body.products).toHaveLength(1);
    expect(addRes.body.products[0].id).toBe(productId);

    // 3. Obtener wishlist y verificar producto
    const getRes = await request(app.getHttpServer())
      .get('/api/v1/wishlist')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(getRes.body.products).toHaveLength(1);
    expect(getRes.body.products[0].name).toBe('Novel');

    // 4. Eliminar producto de la wishlist
    const delRes = await request(app.getHttpServer())
      .delete(`/api/v1/wishlist/products/${productId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(delRes.body.products).toHaveLength(0);
  });
});

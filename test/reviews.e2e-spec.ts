import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, verifyUserEmail } from './test-utils';
import { OrderStatus } from '../src/modules/orders/entities/order.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { UserRole } from '../src/common/enums';

describe('Reviews E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let customerToken: string;
  let productId: string;
  let categoryId: string;
  const testCustomerEmail = `customer-${Date.now()}@test.com`;
  const testAdminEmail = `admin-${Date.now()}@test.com`;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    // Limpiar tablas
    await dataSource.query('TRUNCATE TABLE product_reviews CASCADE');
    await dataSource.query('TRUNCATE TABLE order_items CASCADE');
    await dataSource.query('TRUNCATE TABLE "order" CASCADE');
    await dataSource.query('TRUNCATE TABLE products CASCADE');
    await dataSource.query('TRUNCATE TABLE categories CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');

    // 1. Crear Admin para crear categorías y productos
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: testAdminEmail,
      password: 'Password123!',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    });

    await verifyUserEmail(app, testAdminEmail);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testAdminEmail,
        password: 'Password123!',
      });
    adminToken = adminLogin.body.access_token;

    // 2. Crear Cliente para comprar y reseñar
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: testCustomerEmail,
      password: 'Password123!',
      firstName: 'Customer',
      lastName: 'User',
      role: UserRole.CUSTOMER,
    });

    await verifyUserEmail(app, testCustomerEmail);

    const customerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testCustomerEmail,
        password: 'Password123!',
      });
    customerToken = customerLogin.body.access_token;

    // 3. Crear Categoría de prueba
    const categoryRes = await request(app.getHttpServer())
      .post('/api/v1/products/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Books',
        slug: 'books',
        description: 'Reading books',
      });
    categoryId = categoryRes.body.id;

    // 4. Crear Producto de prueba
    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'The NestJS Book',
        slug: 'nestjs-book',
        description: 'Complete guide to NestJS framework.',
        price: 49.99,
        stockQuantity: 20,
        categoryId,
        sku: 'BOOK-NESTJS-01',
      });
    productId = productRes.body.id;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('POST /api/v1/products/:id/reviews', () => {
    it('should fail to add review if product has not been purchased', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: 'Outstanding book! Liked it a lot.',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain(
        'You can only review products you have purchased',
      );
    });

    it('should allow adding review after product is purchased', async () => {
      // 1. Agregar el producto al carrito
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId,
          quantity: 1,
        })
        .expect(201);

      // 2. Crear una orden a partir del carrito
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddress: {
            street: '123 Test St',
            city: 'Testville',
            state: 'TX',
            country: 'USA',
            postalCode: '12345',
          },
          billingAddress: {
            street: '123 Test St',
            city: 'Testville',
            state: 'TX',
            country: 'USA',
            postalCode: '12345',
          },
        });

      expect(orderRes.status).toBe(201);
      const orderId = orderRes.body.id;

      // Actualizar estado de orden a PAID/COMPLETED para pasar la validación
      await dataSource.query(
        `UPDATE "order" SET "orderStatus" = $1 WHERE id = $2`,
        [OrderStatus.PAID, orderId],
      );

      // Ahora intentar dejar reseña
      const reviewRes = await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 4,
          comment: 'Very informative and clear.',
        });

      expect(reviewRes.status).toBe(201);
      expect(reviewRes.body).toHaveProperty('id');
      expect(reviewRes.body.rating).toBe(4);
      expect(reviewRes.body.comment).toBe('Very informative and clear.');

      // Verificar estadísticas del producto
      const product: any = await dataSource.getRepository(Product).findOne({
        where: { id: productId },
      });
      expect(Number(product.averageRating)).toBe(4);
      expect(product.reviewCount).toBe(1);
    });

    it('should fail if trying to add duplicate review for same product', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 3,
          comment: 'Another comment.',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already reviewed');
    });
  });

  describe('GET /api/v1/products/:id/reviews', () => {
    it('should list reviews for a product', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}/reviews`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].rating).toBe(4);
      expect(res.body.data[0].comment).toBe('Very informative and clear.');
      expect(res.body.data[0].user).toBeDefined();
      expect(res.body.data[0].user).not.toHaveProperty('password');
      expect(res.body.data[0].user).not.toHaveProperty('twoFactorSecret');
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('DELETE /api/v1/products/reviews/:id', () => {
    let reviewId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}/reviews`)
        .expect(200);
      reviewId = res.body.data[0].id;
    });

    it('should fail to delete review if user is not author or admin', async () => {
      // Generar otro usuario cliente
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'other@test.com',
        password: 'Password123!',
        firstName: 'Other',
        lastName: 'User',
        role: UserRole.CUSTOMER,
      });
      await verifyUserEmail(app, 'other@test.com');
      const otherLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'other@test.com',
          password: 'Password123!',
        });
      const otherToken = otherLogin.body.access_token;

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/products/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(deleteRes.status).toBe(403);
    });

    it('should allow author to delete review and update stats', async () => {
      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/products/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toContain('Review deleted successfully');

      // Verificar estadísticas del producto
      const product: any = await dataSource.getRepository(Product).findOne({
        where: { id: productId },
      });
      expect(Number(product.averageRating)).toBe(0);
      expect(product.reviewCount).toBe(0);
    });
  });
});

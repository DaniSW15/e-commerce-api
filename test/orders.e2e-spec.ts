import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, verifyUserEmail } from './test-utils';
import { DataSource } from 'typeorm';
import {
  Product,
  ProductStatus,
} from '../src/modules/products/entities/product.entity';
import { Category } from '../src/modules/products/entities/category.entity';

describe('OrdersController (e2e) - Checkout from Cart', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let customerToken: string;
  let adminToken: string;
  let productId: string;
  const customerEmail = `customer-${Date.now()}@example.com`;
  const adminEmail = `admin-${Date.now()}@example.com`;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    // 1. Registrar y loguear cliente
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: customerEmail,
      password: 'password123',
      firstName: 'Customer',
      lastName: 'User',
      role: 'customer',
    });
    await verifyUserEmail(app, customerEmail);
    const customerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: customerEmail,
        password: 'password123',
      });
    customerToken = customerLogin.body.access_token;

    // 2. Registrar y loguear admin
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: adminEmail,
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    });
    await verifyUserEmail(app, adminEmail);
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: adminEmail,
        password: 'admin123',
      });
    adminToken = adminLogin.body.access_token;

    // 3. Crear categoría y producto como admin
    const cat = await dataSource.getRepository(Category).save({
      name: 'Electronics',
      slug: `electronics-${Date.now()}`,
      description: 'Gadgets',
    });

    const prod = await dataSource.getRepository(Product).save({
      sku: `SKU-ORD-${Date.now()}`,
      name: 'Phone',
      slug: `phone-${Date.now()}`,
      price: 699.99,
      stockQuantity: 5,
      status: ProductStatus.ACTIVE,
      categoryId: cat.id,
    });
    productId = prod.id;
  }, 30000);

  afterAll(async () => {
    // Limpieza de DB
    if (dataSource) {
      await dataSource.query('TRUNCATE TABLE "order_items" CASCADE');
      await dataSource.query('TRUNCATE TABLE "order" CASCADE');
      await dataSource.query('TRUNCATE TABLE "cart_items" CASCADE');
      await dataSource.query('TRUNCATE TABLE "carts" CASCADE');
      await dataSource.query('TRUNCATE TABLE "products" CASCADE');
      await dataSource.query('TRUNCATE TABLE "categories" CASCADE');
      await dataSource.query('TRUNCATE TABLE "users" CASCADE');
    }
    if (app) await app.close();
  }, 15000);

  it('should checkout successfully from cart and empty it', async () => {
    // 1. Añadir producto al carrito
    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId,
        quantity: 2,
      })
      .expect(201);

    // 2. Realizar checkout
    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shippingAddress: {
          street: '456 Order Rd',
          city: 'Order City',
          state: 'NY',
          country: 'USA',
          postalCode: '10001',
        },
        billingAddress: {
          street: '456 Order Rd',
          city: 'Order City',
          state: 'NY',
          country: 'USA',
          postalCode: '10001',
        },
        notes: 'Leave at door',
      })
      .expect(201);

    expect(orderRes.body).toHaveProperty('id');
    expect(orderRes.body.orderItems).toHaveLength(1);
    expect(orderRes.body.orderItems[0].productId).toBe(productId);
    expect(orderRes.body.orderItems[0].quantity).toBe(2);

    // 3. Verificar que el carrito esté vacío
    const cartRes = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(cartRes.body.items).toHaveLength(0);
    expect(Number(cartRes.body.total)).toBe(0);

    // 4. Verificar disminución del stock
    const updatedProd: any = await dataSource.getRepository(Product).findOne({
      where: { id: productId },
    });
    expect(updatedProd.stockQuantity).toBe(3); // 5 - 2 = 3
  });
});

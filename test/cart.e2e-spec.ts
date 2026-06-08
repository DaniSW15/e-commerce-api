import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { verifyUserEmail } from './test-utils';
import { AppModule } from '../src/app.module';

describe('Cart E2E Tests', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let accessToken: string;
    let userId: string;
    let productId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        app.setGlobalPrefix('api/v1');
        await app.init();

        dataSource = moduleFixture.get<DataSource>(DataSource);

        // Limpiar base de datos
        await dataSource.query('TRUNCATE TABLE carts CASCADE');
        await dataSource.query('TRUNCATE TABLE cart_items CASCADE');
        await dataSource.query('TRUNCATE TABLE users CASCADE');
        await dataSource.query('TRUNCATE TABLE products CASCADE');
        await dataSource.query('TRUNCATE TABLE categories CASCADE');

        // Crear usuario de prueba
        const registerRes = await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: 'cart@test.com',
                password: 'Password123!',
                firstName: 'Cart',
                lastName: 'User',
                role: 'admin',
            });

        userId = registerRes.body.user.id;
        await verifyUserEmail(app, 'cart@test.com');

        // Login
        const loginRes = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'cart@test.com',
                password: 'Password123!',
            });

        accessToken = loginRes.body.access_token;

        // Crear categoría de prueba
        const categoryRes = await request(app.getHttpServer())
            .post('/api/v1/products/categories')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                name: 'Electronics',
                slug: 'electronics',
                description: 'Electronic devices',
            });

        // Crear producto de prueba
        const productRes = await request(app.getHttpServer())
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                name: 'Test Product',
                slug: 'test-product',
                description: 'A test product',
                price: 99.99,
                stockQuantity: 10,
                categoryId: categoryRes.body.id,
                sku: 'TEST-001',
            });

        productId = productRes.body.id;
    });

    afterAll(async () => {
        await app.close();
    });

    describe('GET /api/v1/cart', () => {
        it('should return empty cart for new user', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('id');
            expect(res.body.userId).toBe(userId);
            expect(res.body.items).toEqual([]);
            expect(Number(res.body.total)).toBe(0);
            expect(res.body.itemCount).toBe(0);
        });
    });

    describe('POST /api/v1/cart/items', () => {
        it('should add product to cart', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/cart/items')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    productId,
                    quantity: 2,
                })
                .expect(201);

            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].productId).toBe(productId);
            expect(res.body.items[0].quantity).toBe(2);
            expect(Number(res.body.items[0].price)).toBe(99.99);
            expect(Number(res.body.items[0].subtotal)).toBe(199.98);
            expect(res.body.itemCount).toBe(2);
        });

        it('should increase quantity when adding same product', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/cart/items')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    productId,
                    quantity: 1,
                })
                .expect(201);

            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].quantity).toBe(3);
            expect(res.body.itemCount).toBe(3);
        });

        it('should fail if product not found', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/cart/items')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    productId: '00000000-0000-0000-0000-000000000000',
                    quantity: 1,
                })
                .expect(404);
        });

        it('should fail if insufficient stock', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/cart/items')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    productId,
                    quantity: 100,
                })
                .expect(400);
        });
    });

    describe('PATCH /api/v1/cart/items/:id', () => {
        it('should update cart item quantity', async () => {
            const cartRes = await request(app.getHttpServer())
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            const itemId = cartRes.body.items[0].id;

            const res = await request(app.getHttpServer())
                .patch(`/api/v1/cart/items/${itemId}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    quantity: 5,
                })
                .expect(200);

            expect(res.body.items[0].quantity).toBe(5);
            expect(res.body.itemCount).toBe(5);
        });
    });

    describe('DELETE /api/v1/cart/items/:id', () => {
        it('should remove item from cart', async () => {
            const cartRes = await request(app.getHttpServer())
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            const itemId = cartRes.body.items[0].id;

            const res = await request(app.getHttpServer())
                .delete(`/api/v1/cart/items/${itemId}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body.items).toHaveLength(0);
            expect(res.body.itemCount).toBe(0);
            expect(Number(res.body.total)).toBe(0);
        });
    });

    describe('DELETE /api/v1/cart', () => {
        it('should clear entire cart', async () => {
            // Limpiar cart items previos de otros tests
            await dataSource.query('DELETE FROM cart_items');
            await dataSource.query('UPDATE carts SET subtotal = 0, tax = 0, total = 0, "itemCount" = 0');

            // Agregar items primero
            await request(app.getHttpServer())
                .post('/api/v1/cart/items')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    productId,
                    quantity: 2,
                });

            const res = await request(app.getHttpServer())
                .delete('/api/v1/cart')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body.message).toBe('Cart cleared successfully');

            // Verificar que el carrito está vacío
            const cartRes = await request(app.getHttpServer())
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(cartRes.body.items).toHaveLength(0);
            expect(Number(cartRes.body.total)).toBe(0);
        });
    });
});

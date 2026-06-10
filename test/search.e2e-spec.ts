import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Product Search E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let categoryId: string;
  let product1Id: string;
  let product2Id: string;
  let product3Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Limpiar datos previos (orden correcto para foreign keys)
    await dataSource.query('DELETE FROM cart_items');
    await dataSource.query('DELETE FROM carts');
    await dataSource.query('DELETE FROM product_images');
    await dataSource.query('DELETE FROM products');
    await dataSource.query('DELETE FROM categories');
    await dataSource.query('DELETE FROM refresh_tokens');
    await dataSource.query('DELETE FROM login_attempts');
    await dataSource.query('DELETE FROM user_addresses');
    await dataSource.query('DELETE FROM user_profiles');
    await dataSource.query('DELETE FROM users');

    // Crear usuario admin para tests
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'search-test@example.com',
        password: 'Test123456!',
        role: 'admin',
      });

    accessToken = registerRes.body.access_token;

    // Crear categoría
    const categoryRes = await request(app.getHttpServer())
      .post('/api/v1/products/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices',
      });

    categoryId = categoryRes.body.id;

    // Crear productos de prueba con diferentes contenidos
    const product1Res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Laptop Gaming Pro',
        slug: 'laptop-gaming-pro',
        description:
          'High performance gaming laptop with RGB keyboard and powerful graphics card',
        price: 1299.99,
        stockQuantity: 10,
        categoryId,
        sku: 'LAPTOP-001',
        status: 'active',
      })
      .expect(201);
    product1Id = product1Res.body.id;

    const product2Res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Wireless Gaming Mouse',
        slug: 'wireless-gaming-mouse',
        description:
          'Ergonomic wireless mouse perfect for gaming and productivity',
        price: 59.99,
        stockQuantity: 50,
        categoryId,
        sku: 'MOUSE-001',
        status: 'active',
      })
      .expect(201);
    product2Id = product2Res.body.id;

    const product3Res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Mechanical Keyboard RGB',
        slug: 'mechanical-keyboard-rgb',
        description:
          'Professional mechanical keyboard with customizable RGB lighting',
        price: 149.99,
        stockQuantity: 25,
        categoryId,
        sku: 'KEYBOARD-001',
        status: 'active',
      })
      .expect(201);
    product3Id = product3Res.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/products/search', () => {
    it('should search products by name', async () => {
      // Verificar que los productos existen
      const allProducts = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200);

      console.log('Total products in DB:', allProducts.body.data.length);
      console.log('Product IDs:', [product1Id, product2Id, product3Id]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ query: 'gaming' })
        .expect(200);

      console.log('Search results:', res.body);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta.query).toBe('gaming');

      // Verificar que al menos 2 productos contienen "gaming"
      const gamingProducts = res.body.data.filter(
        (p: any) =>
          p.name.toLowerCase().includes('gaming') ||
          p.description.toLowerCase().includes('gaming'),
      );
      expect(gamingProducts.length).toBeGreaterThanOrEqual(2);
    });

    it('should search products by description content', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ query: 'wireless' })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      const found = res.body.data.some((p: any) => p.id === product2Id);
      expect(found).toBe(true);
    });

    it('should search products by SKU', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ query: 'LAPTOP-001' })
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(product1Id);
      expect(res.body.data[0].sku).toBe('LAPTOP-001');
    });

    it('should filter search results by category', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({
          query: 'gaming',
          categoryId,
        })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((product: any) => {
        expect(product.categoryId).toBe(categoryId);
      });
    });

    it('should filter search results by price range', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({
          query: 'gaming',
          minPrice: 50,
          maxPrice: 100,
        })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((product: any) => {
        expect(Number(product.price)).toBeGreaterThanOrEqual(50);
        expect(Number(product.price)).toBeLessThanOrEqual(100);
      });
    });

    it('should sort results by price ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({
          query: 'gaming',
          sortBy: 'price_asc',
        })
        .expect(200);

      expect(res.body.meta.sortBy).toBe('price_asc');

      if (res.body.data.length > 1) {
        for (let i = 0; i < res.body.data.length - 1; i++) {
          const price1 = Number(res.body.data[i].price);
          const price2 = Number(res.body.data[i + 1].price);
          expect(price1).toBeLessThanOrEqual(price2);
        }
      }
    });

    it('should sort results by price descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({
          query: 'gaming',
          sortBy: 'price_desc',
        })
        .expect(200);

      expect(res.body.meta.sortBy).toBe('price_desc');

      if (res.body.data.length > 1) {
        for (let i = 0; i < res.body.data.length - 1; i++) {
          const price1 = Number(res.body.data[i].price);
          const price2 = Number(res.body.data[i + 1].price);
          expect(price1).toBeGreaterThanOrEqual(price2);
        }
      }
    });

    it('should sort results by name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({
          query: 'gaming',
          sortBy: 'name',
        })
        .expect(200);

      expect(res.body.meta.sortBy).toBe('name');

      if (res.body.data.length > 1) {
        for (let i = 0; i < res.body.data.length - 1; i++) {
          const name1 = res.body.data[i].name;
          const name2 = res.body.data[i + 1].name;
          expect(name1.localeCompare(name2)).toBeLessThanOrEqual(0);
        }
      }
    });

    it('should paginate search results', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({
          query: 'gaming',
          page: 1,
          limit: 2,
        })
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should handle multi-word search queries', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ query: 'RGB keyboard' })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      // Debe encontrar el laptop (tiene "RGB keyboard" en descripción)
      const foundLaptop = res.body.data.some((p: any) => p.id === product1Id);
      expect(foundLaptop).toBe(true);
    });

    it('should return empty results for non-matching query', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ query: 'nonexistentproduct12345' })
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should require query parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .expect(400);

      // El mensaje de validación es un array de errores
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(
        res.body.message.some((msg: string) => msg.includes('query')),
      ).toBe(true);
    });

    it('should include category and images in results', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ query: 'laptop' })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      const product = res.body.data[0];
      expect(product).toHaveProperty('category');
      expect(product).toHaveProperty('images');
    });
  });
});

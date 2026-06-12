import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product, ProductStatus } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { ProductImage } from './entities/product-image.entity';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SearchSortBy } from './dto/search-product.dto';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepo: ReturnType<typeof mockRepository>;
  let categoryRepo: ReturnType<typeof mockRepository>;
  let imageRepo: ReturnType<typeof mockRepository>;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Category),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(ProductImage),
          useValue: mockRepository(),
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productRepo = module.get(getRepositoryToken(Product));
    categoryRepo = module.get(getRepositoryToken(Category));
    imageRepo = module.get(getRepositoryToken(ProductImage));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCategory', () => {
    it('should throw ConflictException if category slug exists', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ id: 'cat-id' });
      await expect(
        service.createCategory({ name: 'Cat', slug: 'cat' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create and save a new category', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(null);
      const mockCat = { id: 'cat-id', name: 'Cat', slug: 'cat' };
      categoryRepo.create.mockReturnValue(mockCat);
      categoryRepo.save.mockResolvedValue(mockCat);

      const result = await service.createCategory({ name: 'Cat', slug: 'cat' });
      expect(result).toEqual(mockCat);
    });
  });

  describe('getCategoryTree', () => {
    it('should get category tree', async () => {
      categoryRepo.find.mockResolvedValueOnce([]);
      const result = await service.getCategoryTree();
      expect(result).toEqual([]);
    });
  });

  describe('createProduct', () => {
    it('should throw ConflictException if sku exists', async () => {
      productRepo.findOne.mockResolvedValueOnce({ id: 'p-id' });
      await expect(
        service.create({
          sku: 'sku',
          name: 'p',
          slug: 'p',
          price: 10,
          stockQuantity: 5,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if slug exists', async () => {
      productRepo.findOne.mockResolvedValueOnce(null); // sku check
      productRepo.findOne.mockResolvedValueOnce({ id: 'p-id' }); // slug check
      await expect(
        service.create({
          sku: 'sku',
          name: 'p',
          slug: 'p',
          price: 10,
          stockQuantity: 5,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create product with images', async () => {
      productRepo.findOne.mockResolvedValueOnce(null); // sku check
      productRepo.findOne.mockResolvedValueOnce(null); // slug check
      const mockProduct = {
        id: 'p-id',
        sku: 'sku',
        name: 'p',
        slug: 'p',
        price: 10,
        stockQuantity: 5,
      };
      productRepo.create.mockReturnValue(mockProduct);
      productRepo.save.mockResolvedValueOnce(mockProduct);
      imageRepo.create.mockReturnValue({});
      imageRepo.save.mockResolvedValueOnce([]);
      productRepo.findOne.mockResolvedValueOnce(mockProduct); // findById after creation

      const result = await service.create({
        sku: 'sku',
        name: 'p',
        slug: 'p',
        price: 10,
        stockQuantity: 5,
        imageUrls: ['url1', 'url2'],
      });

      expect(result).toEqual(mockProduct);
      expect(imageRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should find products with active status and filters', async () => {
      productRepo.findAndCount.mockResolvedValueOnce([[], 0]);
      const result = await service.findAll({
        search: 'test',
        categoryId: 'cat-1',
        minPrice: 10,
        maxPrice: 100,
        page: 1,
        limit: 10,
      });
      expect(result.data).toEqual([]);
      expect(productRepo.findAndCount).toHaveBeenCalled();
    });

    it('should find products with active status and minPrice only', async () => {
      productRepo.findAndCount.mockResolvedValueOnce([[], 0]);
      const result = await service.findAll({
        minPrice: 10,
        page: 1,
        limit: 10,
      });
      expect(result.data).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if product not found', async () => {
      productRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return product if found', async () => {
      const mockProduct = { id: 'p-id', name: 'product' };
      productRepo.findOne.mockResolvedValueOnce(mockProduct);
      const result = await service.findById('p-id');
      expect(result).toEqual(mockProduct);
    });
  });

  describe('findBySlug', () => {
    it('should throw NotFoundException if product by slug is not found', async () => {
      productRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findBySlug('non-existent-slug')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return product if slug found', async () => {
      const mockProduct = { id: 'p-id', name: 'product', slug: 'slug' };
      productRepo.findOne.mockResolvedValueOnce(mockProduct);
      const result = await service.findBySlug('slug');
      expect(result).toEqual(mockProduct);
    });
  });

  describe('update', () => {
    it('should update product details', async () => {
      const mockProduct = { id: 'p-id', slug: 'old-slug' };
      productRepo.findOne.mockResolvedValueOnce(mockProduct); // findById
      productRepo.findOne.mockResolvedValueOnce(null); // slug unique check
      productRepo.save.mockResolvedValueOnce({
        ...mockProduct,
        name: 'updated',
      });

      const result = await service.update('p-id', {
        name: 'updated',
        slug: 'new-slug',
      });
      expect(productRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if updated slug already exists', async () => {
      const mockProduct = { id: 'p-id', slug: 'old-slug' };
      productRepo.findOne.mockResolvedValueOnce(mockProduct); // findById
      productRepo.findOne.mockResolvedValueOnce({ id: 'other-id' }); // slug unique check returns another product

      await expect(
        service.update('p-id', { slug: 'new-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should soft delete product', async () => {
      const mockProduct = { id: 'p-id' };
      productRepo.findOne.mockResolvedValueOnce(mockProduct); // findById
      productRepo.softDelete.mockResolvedValueOnce({});
      productRepo.findOne.mockResolvedValueOnce({
        id: 'p-id',
        deletedAt: new Date(),
      }); // deleted verification

      const result = await service.delete('p-id');
      expect(result.message).toContain('deleted successfully');
      expect(productRepo.softDelete).toHaveBeenCalledWith('p-id');
    });
  });

  describe('search', () => {
    it('should search products using query builder', async () => {
      productRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([
        [{ id: 'p-id', name: 'Laptop' }],
        1,
      ]);

      const result = await service.search({
        query: 'Laptop',
        page: 1,
        limit: 10,
        sortBy: SearchSortBy.RELEVANCE,
        categoryId: 'cat-1',
        minPrice: 10,
        maxPrice: 100,
      });

      expect(productRepo.createQueryBuilder).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should handle different sort orders in search', async () => {
      productRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.search({
        query: '',
        page: 1,
        limit: 10,
        sortBy: SearchSortBy.PRICE_ASC,
      });
      await service.search({
        query: '',
        page: 1,
        limit: 10,
        sortBy: SearchSortBy.PRICE_DESC,
      });
      await service.search({
        query: '',
        page: 1,
        limit: 10,
        sortBy: SearchSortBy.NEWEST,
      });
      await service.search({
        query: '',
        page: 1,
        limit: 10,
        sortBy: SearchSortBy.NAME,
      });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
    });

    it('should handle search with minPrice and maxPrice only', async () => {
      productRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.search({ query: '', page: 1, limit: 10, minPrice: 10 });
      await service.search({ query: '', page: 1, limit: 10, maxPrice: 100 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('updateStock', () => {
    it('should throw BadRequestException if stock goes below zero', async () => {
      const mockProduct = { id: 'p-id', stockQuantity: 5 };
      productRepo.findOne.mockResolvedValueOnce(mockProduct);

      await expect(service.updateStock('p-id', -10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update stock and save product', async () => {
      const mockProduct = { id: 'p-id', stockQuantity: 5 };
      productRepo.findOne.mockResolvedValueOnce(mockProduct);
      productRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.updateStock('p-id', 5);
      expect(result.stockQuantity).toBe(10);
      expect(productRepo.save).toHaveBeenCalled();
    });
  });
});

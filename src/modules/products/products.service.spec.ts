import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { ProductImage } from './entities/product-image.entity';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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
      await expect(service.createCategory({ name: 'Cat', slug: 'cat' })).rejects.toThrow(
        ConflictException,
      );
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

  describe('createProduct', () => {
    it('should throw ConflictException if sku exists', async () => {
      productRepo.findOne.mockResolvedValueOnce({ id: 'p-id' });
      await expect(
        service.create({ sku: 'sku', name: 'p', slug: 'p', price: 10, stockQuantity: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if slug exists', async () => {
      productRepo.findOne.mockResolvedValueOnce(null); // sku check
      productRepo.findOne.mockResolvedValueOnce({ id: 'p-id' }); // slug check
      await expect(
        service.create({ sku: 'sku', name: 'p', slug: 'p', price: 10, stockQuantity: 5 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if product not found', async () => {
      productRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should return product if found', async () => {
      const mockProduct = { id: 'p-id', name: 'product' };
      productRepo.findOne.mockResolvedValueOnce(mockProduct);
      const result = await service.findById('p-id');
      expect(result).toEqual(mockProduct);
    });
  });

  describe('search', () => {
    it('should search products using query builder', async () => {
      productRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[{ id: 'p-id', name: 'Laptop' }], 1]);

      const result = await service.search({
        query: 'Laptop',
        page: 1,
        limit: 10,
        sortBy: SearchSortBy.RELEVANCE,
      });

      expect(productRepo.createQueryBuilder).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('updateStock', () => {
    it('should throw BadRequestException if stock goes below zero', async () => {
      const mockProduct = { id: 'p-id', stockQuantity: 5 };
      productRepo.findOne.mockResolvedValueOnce(mockProduct);

      await expect(service.updateStock('p-id', -10)).rejects.toThrow(BadRequestException);
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

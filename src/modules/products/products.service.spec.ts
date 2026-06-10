import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { ProductImage } from './entities/product-image.entity';

// Mock repository factory
const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  softDelete: jest.fn(),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepo: ReturnType<typeof mockRepository>;
  let categoryRepo: ReturnType<typeof mockRepository>;
  let imageRepo: ReturnType<typeof mockRepository>;

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

  it('should create product', async () => {
    const dto = {
      sku: 'SKU-001',
      name: 'Test',
      slug: 'test',
      price: 99.99,
      stockQuantity: 100,
    };

    const savedProduct = { id: 'uuid', ...dto };

    // Configurar mocks para cada llamada en orden:
    // 1. Verificar SKU (debe devolver null - no existe)
    productRepo.findOne.mockResolvedValueOnce(null);

    // 2. Verificar slug (debe devolver null - no existe)
    productRepo.findOne.mockResolvedValueOnce(null);

    // 3. create() y save()
    productRepo.create.mockReturnValue(dto);
    productRepo.save.mockResolvedValue(savedProduct);

    // 4. findById al final (si tu service lo llama)
    productRepo.findOne.mockResolvedValueOnce(savedProduct);

    const result = await service.create(dto);

    expect(result).toHaveProperty('id');
    expect(result.sku).toBe('SKU-001');
    expect(productRepo.save).toHaveBeenCalled();
  });
});

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, MoreThan, IsNull, EntityManager } from 'typeorm';
import { Product, ProductStatus } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { CreateCategoryDto } from './dto/create-categor.dto';
import { SearchProductDto, SearchSortBy } from './dto/search-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(ProductImage)
    private readonly imageRepository: Repository<ProductImage>,
  ) {}

  // ==================== CATEGORIES ====================

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoryRepository.findOne({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Category slug already exists');
    }

    const category = this.categoryRepository.create(dto);
    return this.categoryRepository.save(category);
  }

  async getCategoryTree(): Promise<Category[]> {
    const categories = await this.categoryRepository.find({
      where: { parentId: null },
      relations: { children: true },
      order: { sortOrder: 'ASC' },
    });

    return categories;
  }

  // ==================== PRODUCTS ====================

  async create(dto: CreateProductDto): Promise<Product> {
    // Check SKU unique
    const existing = await this.productRepository.findOne({
      where: { sku: dto.sku },
    });

    if (existing) {
      throw new ConflictException('SKU already exists');
    }

    // Check slug unique
    const slugExists = await this.productRepository.findOne({
      where: { slug: dto.slug },
    });

    if (slugExists) {
      throw new ConflictException('Slug already exists');
    }

    // Create product
    const { imageUrls, ...productData } = dto;
    const product = this.productRepository.create(productData);

    // Save product first to get ID
    const savedProduct = await this.productRepository.save(product);

    // Create images if provided
    if (imageUrls && imageUrls.length > 0) {
      const images = imageUrls.map((url, index) =>
        this.imageRepository.create({
          url,
          product: savedProduct,
          sortOrder: index,
          isPrimary: index === 0,
        }),
      );

      await this.imageRepository.save(images);
    }

    return this.findById(savedProduct.id);
  }

  async findAll(
    filters: ProductFilterDto,
  ): Promise<{ data: Product[]; meta: any }> {
    const { search, categoryId, minPrice, maxPrice, page, limit } = filters;

    const where: any = { status: ProductStatus.ACTIVE, deletedAt: IsNull() };

    if (search) {
      where.name = Like(`%${search}%`);
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (minPrice !== undefined && maxPrice !== undefined) {
      where.price = Between(minPrice, maxPrice);
    } else if (minPrice !== undefined) {
      where.price = MoreThan(minPrice);
    }

    const [data, total] = await this.productRepository.findAndCount({
      where,
      relations: { category: true, images: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async search(
    searchDto: SearchProductDto,
  ): Promise<{ data: Product[]; meta: any }> {
    const { query, categoryId, minPrice, maxPrice, sortBy, page, limit } =
      searchDto;

    // Construir query con QueryBuilder para full-text search
    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.images', 'images')
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.deletedAt IS NULL');

    // Full-text search usando PostgreSQL tsvector
    if (query && query.trim()) {
      const likeQuery = `%${query}%`;

      qb.andWhere(
        `(
          to_tsvector('spanish', coalesce(product.name, '') || ' ' || coalesce(product.description, '')) @@ plainto_tsquery('spanish', :queryRaw) OR
          product.sku ILIKE :likeQuery
        )`,
        { queryRaw: query, likeQuery },
      );

      // Agregar ranking de relevancia si se ordena por relevancia
      if (sortBy === SearchSortBy.RELEVANCE) {
        qb.addSelect(
          `ts_rank(to_tsvector('spanish', coalesce(product.name, '') || ' ' || coalesce(product.description, '')), plainto_tsquery('spanish', :queryRaw)) +
           (CASE WHEN product.sku ILIKE :likeQuery THEN 2.0 ELSE 0.0 END)`,
          'search_rank',
        );
      }
    }

    // Filtro por categoría
    if (categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    // Filtro por rango de precio
    if (minPrice !== undefined && maxPrice !== undefined) {
      qb.andWhere('product.price BETWEEN :minPrice AND :maxPrice', {
        minPrice,
        maxPrice,
      });
    } else if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice });
    } else if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    // Ordenamiento
    switch (sortBy) {
      case SearchSortBy.RELEVANCE:
        if (query && query.trim()) {
          qb.orderBy('search_rank', 'DESC');
        } else {
          qb.orderBy('product.createdAt', 'DESC');
        }
        break;
      case SearchSortBy.PRICE_ASC:
        qb.orderBy('product.price', 'ASC');
        break;
      case SearchSortBy.PRICE_DESC:
        qb.orderBy('product.price', 'DESC');
        break;
      case SearchSortBy.NEWEST:
        qb.orderBy('product.createdAt', 'DESC');
        break;
      case SearchSortBy.NAME:
        qb.orderBy('product.name', 'ASC');
        break;
      default:
        qb.orderBy('product.createdAt', 'DESC');
    }

    // Paginación
    qb.skip((page - 1) * limit).take(limit);

    // Ejecutar query
    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        query,
        sortBy,
      },
    };
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { category: true, images: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { slug, deletedAt: null },
      relations: { category: true, images: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);

    // Check slug if changing
    if (dto.slug && dto.slug !== product.slug) {
      const slugExists = await this.productRepository.findOne({
        where: { slug: dto.slug },
      });
      if (slugExists) {
        throw new ConflictException('Slug already exists');
      }
    }

    Object.assign(product, dto);
    return this.productRepository.save(product);
  }

  async delete(id: string): Promise<{ message: string; deletedAt: Date }> {
    await this.findById(id);

    // Soft delete
    await this.productRepository.softDelete(id);

    // Verificar que se eliminó
    const deleted = await this.productRepository.findOne({
      where: { id },
      withDeleted: true,
      select: { id: true, deletedAt: true },
    });

    return {
      message: 'Product deleted successfully',
      deletedAt: deleted.deletedAt,
    };
  }

  // async delete(id: string): Promise<void> {
  //   const product = await this.findById(id);

  //   // Eliminar imágenes de S3 antes de soft delete
  //   if (product.images?.length > 0) {
  //     for (const image of product.images) {
  //       await this.mediaService.deleteFromS3(image.url);
  //     }
  //   }

  //   await this.productRepository.softDelete(id);
  // }

  async updateStock(
    id: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<Product> {
    const repo = manager
      ? manager.getRepository(Product)
      : this.productRepository;

    const product = await repo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { category: true, images: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stockQuantity + quantity < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    product.stockQuantity += quantity;
    return repo.save(product);
  }
}

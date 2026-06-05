import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, MoreThan, IsNull } from 'typeorm';
import { Product, ProductStatus } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { CreateCategoryDto } from './dto/create-categor.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(ProductImage)
    private readonly imageRepository: Repository<ProductImage>,
  ) { }

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

  async findAll(filters: ProductFilterDto): Promise<{ data: Product[]; meta: any }> {
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
    const product = await this.findById(id);

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

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.findById(id);

    if (product.stockQuantity + quantity < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    product.stockQuantity += quantity;
    return this.productRepository.save(product);
  }
}
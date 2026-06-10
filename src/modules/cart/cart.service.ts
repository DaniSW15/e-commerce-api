import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ProductsService } from '@modules/products/products.service';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    private readonly productsService: ProductsService,
    private readonly dataSource: DataSource,
  ) {}

  async getOrCreateCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { userId },
      relations: {
        items: {
          product: true,
        },
      },
    });

    if (!cart) {
      cart = this.cartRepository.create({
        userId,
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        itemCount: 0,
      });
      cart = await this.cartRepository.save(cart);
    }

    // Asegurar que items sea un array
    if (!cart.items) {
      cart.items = [];
    }

    return cart;
  }

  async addItem(userId: string, addToCartDto: AddToCartDto): Promise<Cart> {
    const { productId, quantity } = addToCartDto;

    // Verificar que el producto existe y tiene stock
    const product = await this.productsService.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    if (product.stockQuantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stockQuantity}`,
      );
    }

    // Obtener o crear carrito
    const cart = await this.getOrCreateCart(userId);

    // Verificar si el producto ya está en el carrito
    let cartItem = cart.items?.find((item) => item.productId === productId);

    if (cartItem) {
      // Actualizar cantidad
      const newQuantity = cartItem.quantity + quantity;
      if (product.stockQuantity < newQuantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${product.stockQuantity}, in cart: ${cartItem.quantity}`,
        );
      }
      cartItem.quantity = newQuantity;
      cartItem.subtotal = Number((cartItem.price * newQuantity).toFixed(2));
      await this.cartItemRepository.save(cartItem);
    } else {
      // Crear nuevo item
      cartItem = this.cartItemRepository.create({
        cartId: cart.id,
        productId,
        quantity,
        price: product.price,
        subtotal: Number((product.price * quantity).toFixed(2)),
      });
      await this.cartItemRepository.save(cartItem);
    }

    // Recalcular totales
    return this.recalculateCart(cart.id);
  }

  async updateItem(
    userId: string,
    itemId: string,
    updateDto: UpdateCartItemDto,
  ): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
      relations: {
        product: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with id ${itemId} not found`);
    }

    // Verificar stock
    if (cartItem.product.stockQuantity < updateDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${cartItem.product.stockQuantity}`,
      );
    }

    cartItem.quantity = updateDto.quantity;
    cartItem.subtotal = Number(
      (cartItem.price * updateDto.quantity).toFixed(2),
    );
    await this.cartItemRepository.save(cartItem);

    return this.recalculateCart(cart.id);
  }

  async removeItem(userId: string, itemId: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with id ${itemId} not found`);
    }

    await this.cartItemRepository.remove(cartItem);

    return this.recalculateCart(cart.id);
  }

  async clearCart(userId: string): Promise<{ message: string }> {
    const cart = await this.cartRepository.findOne({
      where: { userId },
      relations: {
        items: true,
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Eliminar todos los items usando delete en lugar de remove
    if (cart.items && cart.items.length > 0) {
      await this.cartItemRepository.delete({ cartId: cart.id });
    }

    // Actualizar totales del carrito
    cart.subtotal = 0;
    cart.tax = 0;
    cart.total = 0;
    cart.itemCount = 0;
    await this.cartRepository.save(cart);

    // Limpiar el EntityManager para forzar reload en próximas queries
    this.dataSource.manager.clear(CartItem);

    return { message: 'Cart cleared successfully' };
  }

  async getCart(userId: string): Promise<Cart> {
    // Usar QueryBuilder con cache: false para evitar caché
    const cart = await this.cartRepository
      .createQueryBuilder('cart')
      .leftJoinAndSelect('cart.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('cart.userId = :userId', { userId })
      .cache(false)
      .getOne();

    if (!cart) {
      // Crear carrito si no existe
      return this.getOrCreateCart(userId);
    }

    // Asegurar que items sea un array
    if (!cart.items) {
      cart.items = [];
    }

    return cart;
  }

  private async recalculateCart(cartId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
      relations: {
        items: {
          product: true,
        },
      },
    });

    if (!cart) {
      throw new NotFoundException(`Cart with id ${cartId} not found`);
    }

    // Calcular subtotal
    const subtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0,
    );

    // Calcular impuesto (ejemplo: 10%)
    const taxRate = 0.1;
    const tax = Number((subtotal * taxRate).toFixed(2));

    // Total
    const total = Number((subtotal + tax).toFixed(2));

    // Cantidad de items
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    cart.subtotal = subtotal;
    cart.tax = tax;
    cart.total = total;
    cart.itemCount = itemCount;

    return this.cartRepository.save(cart);
  }
}

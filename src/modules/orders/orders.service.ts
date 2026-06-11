import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus, PaymentStatus } from './entities/order.entity';
import { DataSource, Repository } from 'typeorm';
import { OrderItem } from './entities/order-item.entity';
import { ProductsService } from '../products/products.service';
import { CartService } from '../cart/cart.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly productsService: ProductsService,
    private readonly cartService: CartService,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateOrderDto): Promise<Order> {
    const cart = await this.cartService.getCart(userId);
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cannot place an order with an empty cart');
    }

    let subtotal = 0;
    const orderItems: OrderItem[] = [];

    for (const item of cart.items) {
      const product = item.product;
      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}`,
        );
      }
      const itemSubtotal = Number(product.price) * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push(
        this.orderItemRepository.create({
          productId: item.productId,
          productName: product.name,
          productPrice: product.price,
          quantity: item.quantity,
          attributes: {},
          subtotal: itemSubtotal,
        }),
      );
    }

    const taxAmount = subtotal * 0.1; // Example tax calculation (10%)
    const shippingCost = subtotal > 100 ? 0 : 10; // Free shipping for orders over $100
    const total = subtotal + taxAmount + shippingCost;

    const orderNumber = await this.generateOrderNumber();

    const order = await this.dataSource.transaction(async (manager) => {
      const newOrder = manager.create(Order, {
        orderNumber,
        userId,
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        shippingAddress: dto.shippingAddress,
        billingAddress: dto.billingAddress,
        subtotal,
        taxAmount,
        shippingCost,
        discountAmount: 0,
        total,
        currency: 'USD',
        notes: dto.notes,
        orderItems: orderItems,
      });

      const savedOrder = await manager.save(newOrder);

      // Decrease stock quantity
      for (const item of cart.items) {
        await this.productsService.updateStock(item.productId, -item.quantity);
      }

      // Empty the cart
      await this.cartService.clearCart(userId);

      return savedOrder;
    });

    return this.findById(order.id);
  }

  async findById(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { orderItems: true },
    });
    if (!order) throw new BadRequestException('Order not found');

    return order;
  }

  async findByUser(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      relations: { orderItems: true },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findById(id);

    const validTransitions = this.getValidStatusTransitions(order.orderStatus);
    if (!validTransitions.includes(status)) {
      throw new BadRequestException(
        `Invalid status transition from ${order.orderStatus} to ${status}`,
      );
    }

    order.orderStatus = status;
    return await this.orderRepository.save(order);
  }

  async cancel(id: string, userId: string): Promise<Order> {
    const order = await this.findById(id);
    if (order.userId !== userId)
      throw new BadRequestException('You can only cancel your own orders');

    if (order.orderStatus !== OrderStatus.PENDING)
      throw new BadRequestException('Only pending orders can be cancelled');

    await this.dataSource.transaction(async (manager) => {
      order.orderStatus = OrderStatus.CANCELLED;
      await manager.save(order);

      // Restore stock quantity
      for (const item of order.orderItems) {
        await this.productsService.updateStock(item.productId, item.quantity);
      }
    });

    return order;
  }

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const prefix = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `ORD-${prefix}-${random}`;
  }

  private getValidStatusTransitions(currentStatus: OrderStatus): OrderStatus[] {
    const transitions = {
      [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };
    return transitions[currentStatus] || [];
  }
}

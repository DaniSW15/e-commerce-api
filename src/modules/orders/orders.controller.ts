import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create(userId, createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my orders' })
  async findByUser(@CurrentUser('id') userId: string) {
    return this.ordersService.findByUser(userId); // ← Lista de órdenes
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async findById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const order = await this.ordersService.findById(id);
    // Vertificar que la orden pertenece al usuario
    if (order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order' })
  async cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.ordersService.cancel(id, userId);
  }
}

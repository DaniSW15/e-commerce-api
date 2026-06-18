import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, Roles } from '@/common/decorators';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { UserRole } from '@/common/enums';
import { OrderStatus } from './entities/order.entity';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('admin')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DEVELOPER, UserRole.SELLER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get all orders in the system (Admins/Sellers only)' })
  async findAll() {
    return this.ordersService.findAll();
  }

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
  async findById(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    const order = await this.ordersService.findById(id);
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DEVELOPER, UserRole.SELLER].includes(role);
    // Verificar que la orden pertenece al usuario o que el solicitante es admin/seller
    if (order.userId !== userId && !isAdmin) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order' })
  async cancel(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DEVELOPER, UserRole.SELLER].includes(role);
    return this.ordersService.cancel(id, userId, isAdmin);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DEVELOPER, UserRole.SELLER)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update order status (Admins/Sellers only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateStatus(id, status);
  }
}

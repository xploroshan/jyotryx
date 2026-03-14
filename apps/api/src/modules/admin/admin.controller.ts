import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService, DashboardStats, UserListItem, AdminUserUpdate } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats returned' })
  async getDashboard(): Promise<DashboardStats> {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination' })
  @ApiResponse({ status: 200, description: 'User list returned' })
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<{ users: UserListItem[]; total: number }> {
    return this.adminService.getUsers(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
      search,
    );
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user role or credits' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async updateUser(
    @Param('id') userId: string,
    @Body() dto: AdminUserUpdate,
  ): Promise<UserListItem> {
    return this.adminService.updateUser(userId, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  async deleteUser(@Param('id') userId: string): Promise<{ deleted: boolean }> {
    return this.adminService.deleteUser(userId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get recent payments' })
  @ApiResponse({ status: 200, description: 'Payment list returned' })
  async getPayments(@Query('limit') limit?: string) {
    return this.adminService.getRecentPayments(parseInt(limit || '20', 10));
  }

  @Get('chats')
  @ApiOperation({ summary: 'Get recent chat sessions' })
  @ApiResponse({ status: 200, description: 'Chat session list returned' })
  async getChats(@Query('limit') limit?: string) {
    return this.adminService.getRecentChats(parseInt(limit || '20', 10));
  }
}

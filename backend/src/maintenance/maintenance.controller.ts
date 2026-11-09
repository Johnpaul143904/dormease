import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApproveMaintenanceDto } from './dto/approve-maintenance.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { CreateTenantMaintenanceDto } from './dto/create-tenant-maintenance.dto';
import { RejectMaintenanceDto } from './dto/reject-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { MaintenanceService } from './maintenance.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../generated/prisma/enums';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAll() { return this.maintenanceService.findAll(); }

  @Get('me')
  @Roles(UserRole.TENANT)
  findForUser(@Req() request: { user: { sub: number } }) {
    return this.maintenanceService.findForUser(request.user.sub);
  }

  @Get('public')
  @Roles(UserRole.TENANT)
  findPublicAnnouncements() {
    return this.maintenanceService.findPublicAnnouncements();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  create(
    @Req() request: { user: { sub: number } },
    @Body() dto: CreateMaintenanceDto,
  ) {
    return this.maintenanceService.create(dto, request.user.sub);
  }

  @Post('me')
  @Roles(UserRole.TENANT)
  createForUser(
    @Req() request: { user: { sub: number } },
    @Body() dto: CreateTenantMaintenanceDto,
  ) {
    return this.maintenanceService.createForUser(request.user.sub, dto);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: { sub: number } },
    @Body() dto: ApproveMaintenanceDto,
  ) {
    return this.maintenanceService.approve(id, request.user.sub, dto);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: { sub: number } },
    @Body() dto: RejectMaintenanceDto,
  ) {
    return this.maintenanceService.reject(id, request.user.sub, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: { sub: number } },
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.maintenanceService.update(id, request.user.sub, dto);
  }
}

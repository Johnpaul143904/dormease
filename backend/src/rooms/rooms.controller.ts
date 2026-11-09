import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../generated/prisma/enums';

@Roles(UserRole.ADMIN, UserRole.STAFF)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}
  @Get()
  findAll() { return this.roomsService.findAll(); }
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.roomsService.findOne(id); }
  @Post()
  create(@Body() dto: CreateRoomDto) { return this.roomsService.create(dto); }
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoomDto) { return this.roomsService.update(id, dto); }
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.roomsService.remove(id); }
}

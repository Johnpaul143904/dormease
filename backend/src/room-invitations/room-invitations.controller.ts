import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { CreateRoomInvitationDto } from './dto/create-room-invitation.dto';
import { RoomInvitationsService } from './room-invitations.service';

@Controller('room-invitations')
export class RoomInvitationsController {
  constructor(private readonly invitationsService: RoomInvitationsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAll() {
    return this.invitationsService.findAll();
  }

  @Get('me')
  @Roles(UserRole.TENANT)
  findMine(@Req() request: { user: { sub: number } }) {
    return this.invitationsService.findForTenant(request.user.sub);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  create(@Body() dto: CreateRoomInvitationDto) {
    return this.invitationsService.create(dto);
  }

  @Get(':code')
  @Public()
  findByCode(@Param('code') code: string) {
    return this.invitationsService.findByCode(code);
  }

  @Post(':code/request')
  @Roles(UserRole.TENANT)
  requestToJoin(
    @Param('code') code: string,
    @Req() request: { user: { sub: number } },
  ) {
    return this.invitationsService.requestToJoin(code, request.user.sub);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.invitationsService.approve(id);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.invitationsService.reject(id);
  }

  @Post(':id/revoke')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.invitationsService.revoke(id);
  }
}

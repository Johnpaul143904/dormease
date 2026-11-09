import { Module } from '@nestjs/common';
import { RoomInvitationsController } from './room-invitations.controller';
import { RoomInvitationsService } from './room-invitations.service';

@Module({
  controllers: [RoomInvitationsController],
  providers: [RoomInvitationsService],
})
export class RoomInvitationsModule {}

import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateRoomInvitationDto {
  @IsInt()
  @Min(1)
  roomId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}

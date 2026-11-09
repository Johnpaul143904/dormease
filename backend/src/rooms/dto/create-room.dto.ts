import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { RoomStatus } from '../../generated/prisma/enums';

export class CreateRoomDto {
  @IsString()
  roomNumber!: string;
  @IsOptional()
  @IsString()
  building?: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  floor?: number;
  @IsOptional()
  @IsIn(['Single', 'Double', 'Shared'])
  roomType?: string;
  @IsInt()
  @Min(1)
  capacity!: number;
  @IsNumber()
  @Min(0)
  monthlyRent!: number;
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;
}

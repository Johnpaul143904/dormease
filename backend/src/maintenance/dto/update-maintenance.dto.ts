import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MaintenanceStatus } from '../../generated/prisma/enums';

export class UpdateMaintenanceDto {
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  announcementTitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  announcementDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  publicLocation?: string;
}

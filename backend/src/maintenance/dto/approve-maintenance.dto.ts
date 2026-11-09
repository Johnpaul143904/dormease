import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveMaintenanceDto {
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

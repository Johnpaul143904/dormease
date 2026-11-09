import { IsEnum, IsInt, IsString, Min } from 'class-validator';
import { Priority } from '../../generated/prisma/enums';

export class CreateMaintenanceDto {
  @IsInt()
  @Min(1)
  tenantId!: number;
  @IsInt()
  @Min(1)
  roomId!: number;
  @IsString()
  title!: string;
  @IsString()
  description!: string;
  @IsEnum(Priority)
  priority!: Priority;
}

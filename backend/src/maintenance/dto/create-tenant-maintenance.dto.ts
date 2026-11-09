import { IsEnum, IsString, MinLength } from 'class-validator';
import { Priority } from '../../generated/prisma/enums';

export class CreateTenantMaintenanceDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsEnum(Priority)
  priority!: Priority;
}

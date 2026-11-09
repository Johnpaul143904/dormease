import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @Min(1)
  tenantId!: number;
  @IsNumber()
  @Min(0.01)
  amount!: number;
  @IsString()
  @MinLength(2)
  paymentMethod!: string;
  @IsOptional()
  @IsString()
  @MinLength(2)
  description?: string;
  @IsOptional()
  @IsDateString()
  paymentDate?: string;
  @IsOptional()
  @IsDateString()
  dueDate?: string;
  @IsOptional()
  @IsString()
  referenceNumber?: string;
}

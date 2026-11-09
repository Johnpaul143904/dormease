import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePaymentSubmissionDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsIn(['GCash', 'Bank Transfer', 'Cash', 'Other'])
  paymentMethod!: string;

  @IsDateString()
  paymentDate!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  referenceNumber!: string;
}

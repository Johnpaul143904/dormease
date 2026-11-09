import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaymentSubmissionStatus } from '../../generated/prisma/enums';

export class VerifyPaymentSubmissionDto {
  @IsEnum(PaymentSubmissionStatus)
  status!: Extract<PaymentSubmissionStatus, 'APPROVED' | 'REJECTED'>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @MinLength(3)
  remarks?: string;
}

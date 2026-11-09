import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '../generated/prisma/enums';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentSubmissionDto } from './dto/create-payment-submission.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { VerifyPaymentSubmissionDto } from './dto/verify-payment-submission.dto';
import type { PaymentProofFile } from './payment-proof-file.type';
import { PaymentsService } from './payments.service';
import { Roles } from '../auth/roles.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('submissions')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAllSubmissions() {
    return this.paymentsService.findAllSubmissions();
  }

  @Get('submissions/:submissionId/proof')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.TENANT)
  async getProof(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Req() request: { user: { sub: number; role: UserRole } },
    @Res() response: Response,
  ) {
    const proof = await this.paymentsService.getProof(
      submissionId,
      request.user.sub,
      request.user.role,
    );
    response
      .set({
        'Content-Type': proof.mimeType,
        'Content-Length': proof.data.length,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(proof.fileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(proof.data);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get('me')
  @Roles(UserRole.TENANT)
  findForUser(@Req() request: { user: { sub: number } }) {
    return this.paymentsService.findForUser(request.user.sub);
  }

  @Post(':paymentId/submissions')
  @Roles(UserRole.TENANT)
  @UseInterceptors(
    FileInterceptor('proof', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        if (
          ![
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
          ].includes(file.mimetype)
        ) {
          callback(
            new BadRequestException(
              'Payment proof must be JPG, PNG, WEBP, or PDF',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  submitProof(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Req() request: { user: { sub: number } },
    @Body() dto: CreatePaymentSubmissionDto,
    @UploadedFile() file: PaymentProofFile,
  ) {
    return this.paymentsService.submitProof(
      request.user.sub,
      paymentId,
      dto,
      file,
    );
  }

  @Patch('submissions/:submissionId/verify')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  verifySubmission(
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Req() request: { user: { sub: number } },
    @Body() dto: VerifyPaymentSubmissionDto,
  ) {
    return this.paymentsService.verifySubmission(
      submissionId,
      request.user.sub,
      dto,
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePaymentDto) {
    return this.paymentsService.update(id, dto);
  }
}

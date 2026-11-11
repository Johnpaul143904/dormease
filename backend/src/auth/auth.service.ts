import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, RegistrationAccountType } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PasswordResetEmailService } from './password-reset-email.service';

const PASSWORD_RESET_TTL_MS = 20 * 60 * 1000;
const PASSWORD_RESET_RESPONSE = {
  message:
    'If an account with that email exists, you will receive a password reset link shortly.',
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordResetEmailService: PasswordResetEmailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.findUserByEmail(email);
    if (existing) throw new ConflictException('Email is already registered');
    const role =
      dto.accountType === RegistrationAccountType.ADMIN
        ? this.authorizeAdminRegistration(dto.invitationCode)
        : 'TENANT';

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email,
        password: await bcrypt.hash(dto.password, 12),
        role,
        ...(role === 'TENANT' ? { tenant: { create: {} } } : {}),
      },
    });

    return this.issueSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.findUserByEmail(this.normalizeEmail(dto.email));
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.findUserByEmail(this.normalizeEmail(dto.email));
    if (!user) return PASSWORD_RESET_RESPONSE;

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: now },
        });
        await tx.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    try {
      const frontendUrl = this.getFrontendUrl();
      const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await this.passwordResetEmailService.send(
        user.email,
        user.fullName,
        resetUrl,
      );
    } catch {
      await this.prisma.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null },
        data: { usedAt: new Date() },
      });
      this.logger.error(
        'Password reset email delivery failed; the issued reset token was invalidated.',
      );
    }

    return PASSWORD_RESET_RESPONSE;
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72) {
      throw new BadRequestException(
        'Password must be no more than 72 bytes when encoded as UTF-8',
      );
    }

    const tokenHash = this.hashResetToken(dto.token);
    const now = new Date();
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() <= now.getTime()
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const password = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction(
      async (tx) => {
        const claimedToken = await tx.passwordResetToken.updateMany({
          where: {
            id: resetToken.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (claimedToken.count !== 1) {
          throw new UnauthorizedException('Invalid or expired reset token');
        }

        await tx.user.update({
          where: { id: resetToken.userId },
          data: { password },
        });
        await tx.passwordResetToken.updateMany({
          where: { userId: resetToken.userId, usedAt: null },
          data: { usedAt: now },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    return { message: 'Password reset successfully. Please sign in.' };
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getFrontendUrl() {
    const configuredUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const frontendUrl = new URL(configuredUrl);
    if (
      !['http:', 'https:'].includes(frontendUrl.protocol) ||
      frontendUrl.username ||
      frontendUrl.password
    ) {
      throw new Error('FRONTEND_URL must be a valid HTTP(S) URL');
    }
    if (
      this.configService.get<string>('NODE_ENV') === 'production' &&
      frontendUrl.protocol !== 'https:'
    ) {
      throw new Error('FRONTEND_URL must use HTTPS in production');
    }
    return frontendUrl.toString().replace(/\/+$/, '');
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
  }

  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        tenant: {
          select: {
            contactNumber: true,
            address: true,
            emergencyContact: true,
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User account was not found');
    const { tenant, ...profile } = user;
    return {
      user: {
        ...profile,
        contactNumber: tenant?.contactNumber ?? null,
        address: tenant?.address ?? null,
        emergencyContact: tenant?.emergencyContact ?? null,
      },
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!currentUser) throw new NotFoundException('User account was not found');

    const email = dto.email?.trim().toLowerCase();
    const fullName = dto.fullName?.trim();
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            ...(email ? { email } : {}),
            ...(fullName ? { fullName } : {}),
          },
          select: { id: true, fullName: true, email: true, role: true },
        });
        if (
          currentUser.tenant &&
          (dto.contactNumber !== undefined ||
            dto.address !== undefined ||
            dto.emergencyContact !== undefined)
        ) {
          await tx.tenant.update({
            where: { userId },
            data: {
              ...(dto.contactNumber !== undefined
                ? { contactNumber: dto.contactNumber.trim() || null }
                : {}),
              ...(dto.address !== undefined
                ? { address: dto.address.trim() || null }
                : {}),
              ...(dto.emergencyContact !== undefined
                ? { emergencyContact: dto.emergencyContact.trim() || null }
                : {}),
            },
          });
        }
        return updatedUser;
      });
      return {
        user: {
          ...user,
          contactNumber: currentUser.tenant
            ? (dto.contactNumber ?? currentUser.tenant.contactNumber)
            : null,
          address: currentUser.tenant
            ? (dto.address ?? currentUser.tenant.address)
            : null,
          emergencyContact: currentUser.tenant
            ? (dto.emergencyContact ?? currentUser.tenant.emergencyContact)
            : null,
        },
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email address is already in use');
      }
      throw error;
    }
  }

  private authorizeAdminRegistration(invitationCode?: string) {
    const configuredCode = this.configService.get<string>(
      'ADMIN_INVITATION_CODE',
    );
    if (
      !configuredCode ||
      !invitationCode ||
      invitationCode !== configuredCode
    ) {
      throw new ForbiddenException(
        'Admin registration requires a valid invitation code',
      );
    }
    return 'ADMIN' as const;
  }

  async issueSession(user: {
    id: number;
    fullName: string;
    email: string;
    role: string;
  }) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout() {
    return { success: true };
  }

  isProduction() {
    return this.configService.get('NODE_ENV') === 'production';
  }
}

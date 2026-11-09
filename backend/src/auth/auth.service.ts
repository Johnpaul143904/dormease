import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, RegistrationAccountType } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user);
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

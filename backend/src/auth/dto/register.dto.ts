import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum RegistrationAccountType {
  ADMIN = 'ADMIN',
  TENANT = 'TENANT',
}

export class RegisterDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(RegistrationAccountType)
  accountType!: RegistrationAccountType;

  @IsOptional()
  @IsString()
  invitationCode?: string;
}

import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum RegistrationAccountType {
  ADMIN = 'ADMIN',
  TENANT = 'TENANT',
}

export class RegisterDto {
  @IsOptional()
  @IsEnum(RegistrationAccountType)
  accountType?: RegistrationAccountType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  invitationCode?: string;
}

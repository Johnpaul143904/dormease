import { IsByteLength, IsString, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  token!: string;

  @IsString()
  @IsByteLength(8, 72)
  newPassword!: string;
}

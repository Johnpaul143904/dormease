import { IsDateString, IsInt, Min } from 'class-validator';

export class CreateAssignmentDto {
  @IsInt()
  @Min(1)
  tenantId!: number;
  @IsInt()
  @Min(1)
  roomId!: number;
  @IsDateString()
  moveInDate!: string;
}

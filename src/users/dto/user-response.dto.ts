import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, AccountStatus } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ enum: AccountStatus })
  status: AccountStatus;

  @ApiProperty()
  affiliation: string;

  @ApiPropertyOptional()
  departmentRole?: string;

  @ApiProperty()
  purposeOfRequest: string;

  @ApiPropertyOptional()
  reviewedAt?: Date | null;

  @ApiPropertyOptional()
  reviewedBy?: string | null;

  @ApiPropertyOptional()
  reviewNote?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

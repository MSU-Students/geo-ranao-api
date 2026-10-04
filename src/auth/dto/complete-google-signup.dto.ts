import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CompleteGoogleSignupDto {
  @ApiProperty({
    description: 'The pendingToken from the /auth/google/callback redirect',
  })
  @IsString()
  @IsNotEmpty()
  pendingToken: string;

  @ApiProperty({
    description: 'Affiliation or institution, e.g. "Academic Researcher"',
  })
  @IsString()
  @IsNotEmpty()
  affiliation: string;

  @ApiProperty({
    required: false,
    description: 'Department or role, e.g. "Research Assistant"',
  })
  @IsOptional()
  @IsString()
  departmentRole?: string;

  @ApiProperty({ description: 'Purpose of request' })
  @IsString()
  @MinLength(10)
  purposeOfRequest: string;
}

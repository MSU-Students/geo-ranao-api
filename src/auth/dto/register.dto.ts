import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Match } from './match.decorator';

export class RegisterDto {
  // ── Basic Identity ──
  @ApiProperty({ description: 'Full name of the researcher' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'Must match password' })
  @IsString()
  @Match('password', { message: 'confirmPassword must match password' })
  confirmPassword: string;

  // ── Institutional Credentials ──
  @ApiProperty({ description: 'Affiliation or institution, e.g. "Academic Researcher"' })
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

  // ── Application Context ──
  @ApiProperty({
    description:
      'Purpose of request, e.g. "Studying water quality in the shallow depth part using geographic spatial data"',
  })
  @IsString()
  @MinLength(10)
  purposeOfRequest: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsIn } from 'class-validator';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ enum: ['VIEWER', 'RESEARCHER', 'ADMIN'], required: false })
  @IsOptional()
  @IsIn(['VIEWER', 'RESEARCHER', 'ADMIN'])
  role?: 'VIEWER' | 'RESEARCHER' | 'ADMIN';
}

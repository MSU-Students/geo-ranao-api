import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { Match } from './match.decorator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'The token from the reset-password email link' })
  @IsString()
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({ description: 'Must match newPassword' })
  @IsString()
  @Match('newPassword', { message: 'confirmPassword must match newPassword' })
  confirmPassword: string;
}

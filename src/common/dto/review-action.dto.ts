import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewActionDto {
  @ApiPropertyOptional({
    description: 'Optional reason shown to the submitter and kept in the activity log',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

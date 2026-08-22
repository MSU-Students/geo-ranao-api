import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateWaterQualityReadingDto {
  @ApiProperty({ description: 'Fixed station site_id, e.g. "S1A" or "Masiu River"' })
  @IsString()
  siteId: string;

  @ApiProperty()
  @IsDateString()
  dateObserved: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  depthM: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() temperature?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() ph?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() turbidity?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() dissolvedOxygen?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() conductivity?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() tds?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() tss?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() phosphate?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() ammonia?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() nitrate?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() nitrite?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() sulfate?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() chlorophyll?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateWaterQualityReadingsBulkDto {
  @ApiProperty({ type: [CreateWaterQualityReadingDto] })
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CreateWaterQualityReadingDto)
  rows: CreateWaterQualityReadingDto[];
}

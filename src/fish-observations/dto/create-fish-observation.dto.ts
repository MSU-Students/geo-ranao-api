import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { FishCategory, ConservationStatus } from '../entities/fish-observation.entity';

// Fields arrive as multipart/form-data (photos ride alongside), so numeric
// fields need @Type(() => Number) — combined with ValidationPipe's
// transform:true this coerces the incoming form-field strings before
// @IsNumber()/@IsInt() run.
export class CreateFishObservationDto {
  @ApiProperty({ enum: FishCategory })
  @IsEnum(FishCategory)
  category: FishCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  speciesScientific?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  speciesCommon?: string;

  @ApiPropertyOptional({ enum: ConservationStatus })
  @IsOptional()
  @IsEnum(ConservationStatus)
  conservationStatus?: ConservationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  trueLengthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bodyDepthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightG?: number;

  @ApiPropertyOptional({ description: 'General/others category only' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depthM?: number;

  @ApiPropertyOptional({ description: 'General/others category only — count of individuals' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  count?: number;

  @ApiPropertyOptional({ description: 'General/others category only — e.g. Small/Medium/Large' })
  @IsOptional()
  @IsString()
  sizeCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  municipal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barangay?: string;

  @ApiProperty()
  @IsDateString()
  dateObserved: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

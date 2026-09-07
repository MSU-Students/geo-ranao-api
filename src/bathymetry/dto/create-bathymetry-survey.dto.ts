import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsString, Max, Min, ValidateNested } from 'class-validator';

export class DepthSoundingDto {
  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  depth: number;
}

// Points arrive already cleaned by the client (dedup, range, lake-boundary,
// and outlier checks — see useBathymetryClean.ts) — the server re-validates
// shape and bounds but trusts the researcher's cleaning pass rather than
// repeating spatial checks that need the lake polygon to run.
export class CreateBathymetrySurveyDto {
  @ApiProperty({ description: 'e.g. "Nearshore Transect — Marawi, Sept 2026"' })
  @IsString()
  label: string;

  @ApiProperty()
  @IsDateString()
  surveyDate: string;

  @ApiProperty({ type: [DepthSoundingDto] })
  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => DepthSoundingDto)
  points: DepthSoundingDto[];

  @ApiProperty({ description: 'Raw rows dropped during client-side cleaning, kept for admin transparency' })
  @IsInt()
  @Min(0)
  cleanedCount: number;
}

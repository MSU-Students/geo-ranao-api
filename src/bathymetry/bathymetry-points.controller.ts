import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BathymetryService } from './bathymetry.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('bathymetry')
@ApiBearerAuth()
@Controller('bathymetry/points')
export class BathymetryPointsController {
  constructor(private readonly bathymetryService: BathymetryService) {}

  // The fixed grid's current state — what the 2D and 3D map both render
  // from, so they can never disagree about what the lake floor looks like.
  // gridSize (every fixed point, regardless of coverage) lets the admin
  // panel show "N of M points have data" instead of just a raw count.
  @Get()
  @ApiOperation({ summary: 'The fixed bathymetry grid\'s current depth at each covered point' })
  @UseGuards(JwtAuthGuard)
  async findCurrent() {
    const [points, gridSize] = await Promise.all([
      this.bathymetryService.findCurrentPoints(),
      this.bathymetryService.countGrid(),
    ]);
    return {
      points: points.map((p) => ({ lat: p.lat, lng: p.lng, depth: p.currentDepth })),
      gridSize,
    };
  }
}

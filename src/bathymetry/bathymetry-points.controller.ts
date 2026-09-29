import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BathymetryService } from './bathymetry.service';

@ApiTags('bathymetry')
@Controller('bathymetry/points')
export class BathymetryPointsController {
  constructor(private readonly bathymetryService: BathymetryService) {}

  // The fixed grid's current state — what the 2D and 3D map both render
  // from, so they can never disagree about what the lake floor looks like.
  // gridSize (every fixed point, regardless of coverage) lets the admin
  // panel show "N of M points have data" instead of just a raw count.
  // Deliberately public (no guard) — this is what the public, logged-out
  // map view renders, not just the admin/researcher one.
  @Get()
  @ApiOperation({ summary: 'The fixed bathymetry grid\'s current depth at each covered point' })
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

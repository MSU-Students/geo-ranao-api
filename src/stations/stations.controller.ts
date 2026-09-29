import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StationsService } from './stations.service';

@ApiTags('stations')
@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  // Deliberately public (no guard) — station pins are part of the public
  // map/dashboard view, not just the admin/researcher one.
  @Get()
  @ApiOperation({ summary: 'List fixed water-quality sampling stations' })
  async findAll() {
    return this.stationsService.findAll();
  }
}

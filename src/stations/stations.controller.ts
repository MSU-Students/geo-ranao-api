import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StationsService } from './stations.service';

@ApiTags('stations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  @ApiOperation({ summary: 'List fixed water-quality sampling stations' })
  async findAll() {
    return this.stationsService.findAll();
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StationEntity } from './entities/station.entity';

@Injectable()
export class StationsService {
  constructor(
    @InjectRepository(StationEntity)
    private readonly stationsRepo: Repository<StationEntity>,
  ) {}

  async findAll(): Promise<StationEntity[]> {
    return this.stationsRepo.find({ order: { siteId: 'ASC' } });
  }

  async findBySiteId(siteId: string): Promise<StationEntity | null> {
    return this.stationsRepo.findOne({ where: { siteId } });
  }

  async exists(siteId: string): Promise<boolean> {
    return (await this.stationsRepo.count({ where: { siteId } })) > 0;
  }
}

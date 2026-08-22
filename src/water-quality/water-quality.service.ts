import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { WaterQualityReadingEntity, ReviewStatus } from './entities/water-quality-reading.entity';
import { CreateWaterQualityReadingDto } from './dto/create-water-quality-reading.dto';
import { StationsService } from '../stations/stations.service';

export interface WaterQualityReadingFilter {
  status?: ReviewStatus;
  siteId?: string;
  researcherId?: number;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class WaterQualityService {
  constructor(
    @InjectRepository(WaterQualityReadingEntity)
    private readonly repo: Repository<WaterQualityReadingEntity>,
    private readonly stationsService: StationsService,
  ) {}

  private async assertKnownSite(siteId: string): Promise<void> {
    if (!(await this.stationsService.exists(siteId))) {
      throw new BadRequestException(`Unknown site_id "${siteId}" — not one of the registered stations`);
    }
  }

  async create(researcherId: number, dto: CreateWaterQualityReadingDto): Promise<WaterQualityReadingEntity> {
    await this.assertKnownSite(dto.siteId);
    const reading = this.repo.create({ ...dto, researcherId });
    return this.repo.save(reading);
  }

  async createBulk(researcherId: number, rows: CreateWaterQualityReadingDto[]): Promise<WaterQualityReadingEntity[]> {
    const uniqueSiteIds = [...new Set(rows.map((r) => r.siteId))];
    for (const siteId of uniqueSiteIds) await this.assertKnownSite(siteId);

    const batchId = randomUUID();
    const entities = rows.map((row) => this.repo.create({ ...row, researcherId, batchId }));
    return this.repo.save(entities);
  }

  async findAll(filter: WaterQualityReadingFilter): Promise<WaterQualityReadingEntity[]> {
    const where: FindOptionsWhere<WaterQualityReadingEntity> = {};
    if (filter.status) where.reviewStatus = filter.status;
    if (filter.siteId) where.siteId = filter.siteId;
    if (filter.researcherId) where.researcherId = filter.researcherId;
    if (filter.dateFrom && filter.dateTo) {
      where.dateObserved = Between(filter.dateFrom, filter.dateTo);
    } else if (filter.dateFrom) {
      where.dateObserved = MoreThanOrEqual(filter.dateFrom);
    } else if (filter.dateTo) {
      where.dateObserved = LessThanOrEqual(filter.dateTo);
    }
    return this.repo.find({ where, order: { dateObserved: 'DESC', id: 'DESC' } });
  }

  async findById(id: number): Promise<WaterQualityReadingEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async setReviewStatus(
    id: number,
    status: ReviewStatus,
    reviewedBy: string,
    reviewNote?: string,
  ): Promise<WaterQualityReadingEntity> {
    const reading = await this.findById(id);
    if (!reading) throw new NotFoundException('Water quality reading not found');
    reading.reviewStatus = status;
    reading.reviewedBy = reviewedBy;
    reading.reviewedAt = new Date();
    reading.reviewNote = reviewNote ?? null;
    return this.repo.save(reading);
  }

  async setBatchReviewStatus(
    batchId: string,
    status: ReviewStatus,
    reviewedBy: string,
    reviewNote?: string,
  ): Promise<WaterQualityReadingEntity[]> {
    const rows = await this.repo.find({ where: { batchId } });
    if (rows.length === 0) throw new NotFoundException('Batch not found');
    const now = new Date();
    for (const row of rows) {
      row.reviewStatus = status;
      row.reviewedBy = reviewedBy;
      row.reviewedAt = now;
      row.reviewNote = reviewNote ?? null;
    }
    return this.repo.save(rows);
  }
}

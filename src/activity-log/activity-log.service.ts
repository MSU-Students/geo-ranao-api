import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogEntity, ActivitySeverity } from './entities/activity-log.entity';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly repo: Repository<ActivityLogEntity>,
  ) {}

  async log(
    actor: string,
    action: string,
    detail: string,
    severity: ActivitySeverity = ActivitySeverity.NEUTRAL,
  ): Promise<ActivityLogEntity> {
    const entry = this.repo.create({ actor, action, detail, severity });
    return this.repo.save(entry);
  }

  async findAll(): Promise<ActivityLogEntity[]> {
    return this.repo.find({ order: { timestamp: 'DESC' } });
  }
}

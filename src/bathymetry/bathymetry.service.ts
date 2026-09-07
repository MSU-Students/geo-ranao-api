import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BathymetrySurveyEntity, ReviewStatus } from './entities/bathymetry-survey.entity';
import { CreateBathymetrySurveyDto } from './dto/create-bathymetry-survey.dto';

export interface BathymetrySurveyFilter {
  status?: ReviewStatus;
  researcherId?: number;
}

@Injectable()
export class BathymetryService {
  constructor(
    @InjectRepository(BathymetrySurveyEntity)
    private readonly repo: Repository<BathymetrySurveyEntity>,
  ) {}

  async create(researcherId: number, dto: CreateBathymetrySurveyDto): Promise<BathymetrySurveyEntity> {
    const survey = this.repo.create({
      researcherId,
      label: dto.label,
      surveyDate: dto.surveyDate,
      points: dto.points,
      pointCount: dto.points.length,
      cleanedCount: dto.cleanedCount,
    });
    return this.repo.save(survey);
  }

  async findAll(filter: BathymetrySurveyFilter): Promise<BathymetrySurveyEntity[]> {
    const where: FindOptionsWhere<BathymetrySurveyEntity> = {};
    if (filter.status) where.reviewStatus = filter.status;
    if (filter.researcherId) where.researcherId = filter.researcherId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  // What the public map renders — the most recently approved survey, or
  // null if none has been approved yet (the map falls back to the
  // synthetic placeholder in that case).
  async findLatestApproved(): Promise<BathymetrySurveyEntity | null> {
    return this.repo.findOne({
      where: { reviewStatus: ReviewStatus.APPROVED },
      order: { reviewedAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<BathymetrySurveyEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async setReviewStatus(
    id: number,
    status: ReviewStatus,
    reviewedBy: string,
    reviewNote?: string,
  ): Promise<BathymetrySurveyEntity> {
    const survey = await this.findById(id);
    if (!survey) throw new NotFoundException('Bathymetry survey not found');
    survey.reviewStatus = status;
    survey.reviewedBy = reviewedBy;
    survey.reviewedAt = new Date();
    survey.reviewNote = reviewNote ?? null;
    return this.repo.save(survey);
  }
}

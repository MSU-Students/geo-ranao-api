import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BathymetrySurveyEntity, ReviewStatus } from './entities/bathymetry-survey.entity';
import { BathymetrySoundingEntity } from './entities/bathymetry-sounding.entity';
import { CreateBathymetrySurveyDto } from './dto/create-bathymetry-survey.dto';
import { toGeoPoint } from '../common/geo';

export interface BathymetrySurveyFilter {
  status?: ReviewStatus;
  researcherId?: number;
}

// Every read joins `soundings` and orders it by insertion order, so `points`
// (rebuilt from it in the entity's @AfterLoad) comes back in the same order
// the researcher submitted it in.
const SOUNDINGS_ORDER = { id: 'ASC' as const };

@Injectable()
export class BathymetryService {
  constructor(
    @InjectRepository(BathymetrySurveyEntity)
    private readonly repo: Repository<BathymetrySurveyEntity>,
    @InjectRepository(BathymetrySoundingEntity)
    private readonly soundingRepo: Repository<BathymetrySoundingEntity>,
  ) {}

  // Only admins can submit a survey (enforced by the controller's guard),
  // and there's no one else to review an admin's own upload — so it
  // publishes immediately instead of sitting PENDING in the review queue.
  // Runs in a transaction: the survey row and its soundings must land
  // together, or not at all.
  async create(adminId: number, dto: CreateBathymetrySurveyDto, uploadedBy: string): Promise<BathymetrySurveyEntity> {
    return this.repo.manager.transaction(async (manager) => {
      const survey = await manager.save(
        manager.create(BathymetrySurveyEntity, {
          researcherId: adminId,
          label: dto.label,
          surveyDate: dto.surveyDate,
          pointCount: dto.points.length,
          cleanedCount: dto.cleanedCount,
          reviewStatus: ReviewStatus.APPROVED,
          reviewedBy: uploadedBy,
          reviewedAt: new Date(),
        }),
      );
      const soundings = dto.points.map((point) =>
        manager.create(BathymetrySoundingEntity, {
          surveyId: survey.id,
          location: toGeoPoint(point.lat, point.lng),
          depth: point.depth,
        }),
      );
      await manager.save(soundings);
      survey.points = dto.points;
      return survey;
    });
  }

  async findAll(filter: BathymetrySurveyFilter): Promise<BathymetrySurveyEntity[]> {
    const where: FindOptionsWhere<BathymetrySurveyEntity> = {};
    if (filter.status) where.reviewStatus = filter.status;
    if (filter.researcherId) where.researcherId = filter.researcherId;
    return this.repo.find({
      where,
      relations: ['soundings'],
      order: { createdAt: 'DESC', soundings: SOUNDINGS_ORDER },
    });
  }

  // What the public map renders — the most recently approved survey, or
  // null if none has been approved yet (the map falls back to the
  // synthetic placeholder in that case).
  async findLatestApproved(): Promise<BathymetrySurveyEntity | null> {
    return this.repo.findOne({
      where: { reviewStatus: ReviewStatus.APPROVED },
      relations: ['soundings'],
      order: { reviewedAt: 'DESC', soundings: SOUNDINGS_ORDER },
    });
  }

  async findById(id: number): Promise<BathymetrySurveyEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['soundings'],
      order: { soundings: SOUNDINGS_ORDER },
    });
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

  // Permanently retracts a bad upload (its soundings cascade-delete via the
  // FK). If it was the currently-active survey, findLatestApproved()
  // naturally falls through to the next most recently approved one (or the
  // synthetic placeholder if none remain).
  async remove(id: number): Promise<BathymetrySurveyEntity> {
    const survey = await this.findById(id);
    if (!survey) throw new NotFoundException('Bathymetry survey not found');
    await this.repo.remove(survey);
    return survey;
  }
}

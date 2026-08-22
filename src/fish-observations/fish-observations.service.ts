import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FindOptionsWhere, LessThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  ConservationStatus,
  FishCategory,
  FishObservationEntity,
  ReviewStatus,
} from './entities/fish-observation.entity';
import { FishObservationPhotoEntity } from './entities/fish-observation-photo.entity';
import { CreateFishObservationDto } from './dto/create-fish-observation.dto';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

export interface FishObservationFilter {
  status?: ReviewStatus;
  category?: FishCategory;
  researcherId?: number;
}

@Injectable()
export class FishObservationsService {
  private readonly logger = new Logger(FishObservationsService.name);

  constructor(
    @InjectRepository(FishObservationEntity)
    private readonly repo: Repository<FishObservationEntity>,
    @InjectRepository(FishObservationPhotoEntity)
    private readonly photoRepo: Repository<FishObservationPhotoEntity>,
    private readonly storageService: SupabaseStorageService,
  ) {}

  async create(
    researcherId: number,
    dto: CreateFishObservationDto,
    files: Express.Multer.File[],
  ): Promise<FishObservationEntity> {
    const observation = this.repo.create({ ...dto, researcherId });
    const saved = await this.repo.save(observation);

    if (files?.length) {
      const retentionDays = Number(process.env.PHOTO_RETENTION_DAYS ?? 14);
      const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

      const photos = await Promise.all(
        files.map(async (file) => {
          const storagePath = `${saved.id}/${randomUUID()}${extname(file.originalname)}`;
          await this.storageService.upload(storagePath, file.buffer, file.mimetype);
          return this.photoRepo.create({
            observationId: saved.id,
            storagePath,
            originalFileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            expiresAt,
          });
        }),
      );
      await this.photoRepo.save(photos);
    }

    return (await this.findById(saved.id))!;
  }

  async findAll(filter: FishObservationFilter): Promise<FishObservationEntity[]> {
    const where: FindOptionsWhere<FishObservationEntity> = {};
    if (filter.status) where.reviewStatus = filter.status;
    if (filter.category) where.category = filter.category;
    if (filter.researcherId) where.researcherId = filter.researcherId;
    return this.repo.find({
      where,
      relations: ['photos'],
      order: { dateObserved: 'DESC', id: 'DESC' },
    });
  }

  async findById(id: number): Promise<FishObservationEntity | null> {
    return this.repo.findOne({ where: { id }, relations: ['photos'] });
  }

  async setReviewStatus(
    id: number,
    status: ReviewStatus,
    reviewedBy: string,
    reviewNote?: string,
  ): Promise<FishObservationEntity> {
    const observation = await this.findById(id);
    if (!observation) throw new NotFoundException('Fish observation not found');
    observation.reviewStatus = status;
    observation.reviewedBy = reviewedBy;
    observation.reviewedAt = new Date();
    observation.reviewNote = reviewNote ?? null;
    return this.repo.save(observation);
  }

  async summary(status: ReviewStatus = ReviewStatus.APPROVED) {
    const rows = await this.repo.find({ where: { reviewStatus: status } });
    const byCategory: Record<FishCategory, number> = { ENDEMIC: 0, INVASIVE: 0, GENERAL: 0 };
    const byConservationStatus: Record<ConservationStatus, number> = {
      CRITICALLY_ENDANGERED: 0,
      ENDANGERED: 0,
      VULNERABLE: 0,
      LEAST_CONCERN: 0,
      NOT_EVALUATED: 0,
    };
    for (const row of rows) {
      byCategory[row.category]++;
      byConservationStatus[row.conservationStatus]++;
    }
    return { total: rows.length, byCategory, byConservationStatus };
  }

  async getPhoto(observationId: number, photoId: string): Promise<FishObservationPhotoEntity | null> {
    const photo = await this.photoRepo.findOne({ where: { id: photoId, observationId } });
    if (!photo) return null;
    if (photo.expiresAt.getTime() < Date.now()) return null;
    return photo;
  }

  async getPhotoSignedUrl(photo: FishObservationPhotoEntity): Promise<string> {
    return this.storageService.createSignedUrl(photo.storagePath);
  }

  // Runs hourly — the structured observation row stays forever, only the raw
  // image files (and their metadata rows) are purged once past
  // PHOTO_RETENTION_DAYS, per the Phase 1 auto-expiring-storage decision.
  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredPhotos(): Promise<void> {
    const expired = await this.photoRepo.find({ where: { expiresAt: LessThan(new Date()) } });
    if (expired.length === 0) return;

    await this.storageService.remove(expired.map((p) => p.storagePath));
    await this.photoRepo.remove(expired);
    this.logger.log(`Purged ${expired.length} expired fish observation photo(s).`);
  }
}

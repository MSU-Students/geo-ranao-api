import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { BathymetrySurveyEntity, ReviewStatus } from './entities/bathymetry-survey.entity';
import { BathymetrySoundingEntity } from './entities/bathymetry-sounding.entity';
import { BathymetryPointEntity } from './entities/bathymetry-point.entity';
import { CreateBathymetrySurveyDto, DepthSoundingDto } from './dto/create-bathymetry-survey.dto';

export interface BathymetrySurveyFilter {
  status?: ReviewStatus;
  researcherId?: number;
}

const SOUNDINGS_RELATIONS = ['soundings', 'soundings.point'];
const SOUNDINGS_ORDER = { id: 'ASC' as const };

// A raw uploaded point only snaps to a fixed grid point within this
// distance — the grid spans the whole lake at ~500m spacing (worst case,
// a point equidistant from 4 neighbors sits ~350m from its nearest one),
// so anything legitimately inside the lake should land comfortably under
// this. Guards against a stray point (e.g. a GPS glitch just outside the
// seeded coverage) silently attaching to a distant, unrelated fixed point.
const MAX_SNAP_DISTANCE_M = 700;

// How many raw points go into one nearest-fixed-point SQL query — keeps
// the VALUES-list parameter count (3 per row) well under Postgres's limit
// even for a very large upload, at the cost of a few more round trips.
const SNAP_BATCH_SIZE = 500;

interface SnappedPoint {
  pointId: number;
  depth: number;
}

@Injectable()
export class BathymetryService {
  constructor(
    @InjectRepository(BathymetrySurveyEntity)
    private readonly repo: Repository<BathymetrySurveyEntity>,
    @InjectRepository(BathymetryPointEntity)
    private readonly pointRepo: Repository<BathymetryPointEntity>,
  ) {}

  // For each raw point, finds its nearest fixed bathymetry_points row via
  // PostGIS's <-> k-nearest-neighbor operator (GiST-indexed, so this stays
  // fast even against a large batch) — one lateral-join query per batch
  // rather than one round trip per point.
  private async snapToNearestPoints(manager: EntityManager, points: DepthSoundingDto[]): Promise<SnappedPoint[]> {
    const results: SnappedPoint[] = [];

    for (let i = 0; i < points.length; i += SNAP_BATCH_SIZE) {
      const batch = points.slice(i, i + SNAP_BATCH_SIZE);
      const values = batch
        .map((_, j) => `($${j * 3 + 1}::int, $${j * 3 + 2}::double precision, $${j * 3 + 3}::double precision)`)
        .join(', ');
      const params: number[] = [];
      batch.forEach((p, j) => params.push(j, p.lat, p.lng));

      const rows = (await manager.query(
        `
          SELECT c.idx, bp.id AS "pointId", bp.dist
          FROM (VALUES ${values}) AS c(idx, lat, lng)
          CROSS JOIN LATERAL (
            SELECT id, location <-> ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography AS dist
            FROM bathymetry_points
            ORDER BY location <-> ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography
            LIMIT 1
          ) AS bp(id, dist)
        `,
        params,
      )) as { idx: number; pointId: number; dist: number }[];

      for (const row of rows) {
        if (row.dist > MAX_SNAP_DISTANCE_M) continue;
        results.push({ pointId: row.pointId, depth: batch[row.idx]!.depth });
      }
    }

    return results;
  }

  // Writes every touched point's new currentDepth in one statement rather
  // than one UPDATE per point — with a remote database connection, N
  // sequential round trips (N up to the whole grid's size) is the
  // difference between this taking seconds and taking tens of seconds.
  private async bulkUpdatePointDepths(
    manager: EntityManager,
    soundings: BathymetrySoundingEntity[],
    surveyId: number,
    updatedAt: Date,
  ): Promise<void> {
    for (let i = 0; i < soundings.length; i += SNAP_BATCH_SIZE) {
      const batch = soundings.slice(i, i + SNAP_BATCH_SIZE);
      const values = batch
        .map((_, j) => `($${j * 2 + 1}::int, $${j * 2 + 2}::double precision)`)
        .join(', ');
      const params: number[] = [];
      batch.forEach((s) => params.push(s.pointId, s.depth));

      await manager.query(
        `
          UPDATE bathymetry_points AS bp
          SET "currentDepth" = v.depth, "lastSurveyId" = $${batch.length * 2 + 1}, "lastUpdatedAt" = $${batch.length * 2 + 2}
          FROM (VALUES ${values}) AS v(id, depth)
          WHERE bp.id = v.id
        `,
        [...params, surveyId, updatedAt],
      );
    }
  }

  // Only admins can submit a survey (enforced by the controller's guard),
  // and there's no one else to review an admin's own upload — so it
  // publishes immediately instead of sitting PENDING in the review queue.
  //
  // Every raw (already client-cleaned) point snaps to its nearest fixed
  // grid point; points that land on the same fixed point are averaged
  // together. The survey's audit trail (bathymetry_soundings) gets one row
  // per fixed point actually touched — not one per raw upload row — so
  // storage and rendering stay bounded by the fixed grid's size regardless
  // of upload size. Runs in one transaction: survey, soundings, and each
  // touched point's new currentDepth land together or not at all.
  async create(adminId: number, dto: CreateBathymetrySurveyDto, uploadedBy: string): Promise<BathymetrySurveyEntity> {
    const gridSize = await this.pointRepo.count();
    if (gridSize === 0) {
      throw new BadRequestException(
        'No fixed bathymetry points exist yet — run `yarn seed:bathymetry-grid` before publishing a survey.',
      );
    }

    return this.repo.manager.transaction(async (manager) => {
      const survey = await manager.save(
        manager.create(BathymetrySurveyEntity, {
          researcherId: adminId,
          label: dto.label,
          surveyDate: dto.surveyDate,
          pointCount: dto.points.length,
          cleanedCount: dto.cleanedCount,
          pointsUpdated: 0,
          reviewStatus: ReviewStatus.APPROVED,
          reviewedBy: uploadedBy,
          reviewedAt: new Date(),
        }),
      );

      const snapped = await this.snapToNearestPoints(manager, dto.points);
      const byPoint = new Map<number, number[]>();
      for (const s of snapped) {
        const bucket = byPoint.get(s.pointId);
        if (bucket) bucket.push(s.depth);
        else byPoint.set(s.pointId, [s.depth]);
      }

      const now = new Date();
      const soundings = [...byPoint.entries()].map(([pointId, depths]) => {
        const avgDepth = depths.reduce((sum, d) => sum + d, 0) / depths.length;
        return manager.create(BathymetrySoundingEntity, { surveyId: survey.id, pointId, depth: avgDepth });
      });
      if (soundings.length > 0) {
        await manager.save(soundings);
        // One bulk UPDATE instead of one round trip per touched point — with
        // a remote (Supabase) connection, hundreds of sequential updates was
        // the actual bottleneck here, not the PostGIS snapping query.
        await this.bulkUpdatePointDepths(manager, soundings, survey.id, now);
      }

      survey.pointsUpdated = byPoint.size;
      await manager.save(survey);
      survey.points = []; // not reconstructed here — nothing reads a fresh create()'s points today
      return survey;
    });
  }

  // The fixed grid's current state — what the 2D and 3D map both render
  // from. Only points a survey has actually touched carry a depth; the rest
  // are excluded (no data yet there), same as "no approved survey" did
  // before, just per-point instead of all-or-nothing.
  async findCurrentPoints(): Promise<BathymetryPointEntity[]> {
    return this.pointRepo.createQueryBuilder('point').where('point."currentDepth" IS NOT NULL').getMany();
  }

  // Every fixed point, regardless of whether it currently has data — for
  // the admin panel's "N of M points covered" coverage indicator.
  async countGrid(): Promise<number> {
    return this.pointRepo.count();
  }

  async findAll(filter: BathymetrySurveyFilter): Promise<BathymetrySurveyEntity[]> {
    const where: FindOptionsWhere<BathymetrySurveyEntity> = {};
    if (filter.status) where.reviewStatus = filter.status;
    if (filter.researcherId) where.researcherId = filter.researcherId;
    return this.repo.find({
      where,
      relations: SOUNDINGS_RELATIONS,
      order: { createdAt: 'DESC', soundings: SOUNDINGS_ORDER },
    });
  }

  async findById(id: number): Promise<BathymetrySurveyEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: SOUNDINGS_RELATIONS,
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

  // Permanently retracts a bad upload. Every fixed point this survey had
  // touched gets recomputed from whatever sounding history remains for it
  // (the next-most-recent survey to cover that point, or back to "no data"
  // if this was the only one) — so retracting a survey correctly un-does
  // its effect on the map rather than leaving stale values behind.
  async remove(id: number): Promise<BathymetrySurveyEntity> {
    return this.repo.manager.transaction(async (manager) => {
      const survey = await manager.findOne(BathymetrySurveyEntity, { where: { id } });
      if (!survey) throw new NotFoundException('Bathymetry survey not found');

      const soundings = await manager.find(BathymetrySoundingEntity, { where: { surveyId: id } });
      const affectedPointIds = soundings.map((s) => s.pointId);

      await manager.remove(survey);

      for (const pointId of affectedPointIds) {
        const latest = await manager.findOne(BathymetrySoundingEntity, {
          where: { pointId },
          order: { createdAt: 'DESC' },
        });
        await manager.update(BathymetryPointEntity, pointId, {
          currentDepth: latest?.depth ?? null,
          lastSurveyId: latest?.surveyId ?? null,
          lastUpdatedAt: latest?.createdAt ?? null,
        });
      }

      survey.points = [];
      return survey;
    });
  }
}

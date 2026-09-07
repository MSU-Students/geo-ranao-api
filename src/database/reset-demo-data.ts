import { createClient } from '@supabase/supabase-js';
import dataSource from './data-source';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { FishObservationEntity } from '../fish-observations/entities/fish-observation.entity';
import { FishObservationPhotoEntity } from '../fish-observations/entities/fish-observation-photo.entity';
import { WaterQualityReadingEntity } from '../water-quality/entities/water-quality-reading.entity';
import { BathymetrySurveyEntity } from '../bathymetry/entities/bathymetry-survey.entity';
import { ActivityLogEntity } from '../activity-log/entities/activity-log.entity';

// Standalone script — runs outside Nest's DI container (same as data-source.ts
// and seed.ts), so it talks to Supabase Storage directly via process.env
// rather than the SupabaseStorageService, which requires ConfigService.
async function removePhotos(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'fish-photos';
  if (!url || !key) {
    console.warn('SUPABASE_URL / SUPABASE_SECRET_KEY not set — skipping Storage cleanup.');
    return;
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await client.storage.from(bucket).remove(storagePaths);
  if (error) console.warn(`Failed to remove ${storagePaths.length} file(s) from Storage: ${error.message}`);
}

// One-off: wipe all submitted/test data before a demo, keeping only the admin
// account and the fixed stations reference table (the forms depend on it).
async function reset() {
  await dataSource.initialize();

  const photoRepo = dataSource.getRepository(FishObservationPhotoEntity);
  const fishRepo = dataSource.getRepository(FishObservationEntity);
  const wqRepo = dataSource.getRepository(WaterQualityReadingEntity);
  const bathyRepo = dataSource.getRepository(BathymetrySurveyEntity);
  const logRepo = dataSource.getRepository(ActivityLogEntity);
  const userRepo = dataSource.getRepository(UserEntity);

  // Remove the actual files from Supabase Storage before deleting the DB
  // rows that reference them, so nothing gets orphaned in the bucket.
  const photos = await photoRepo.find();
  if (photos.length > 0) {
    await removePhotos(photos.map((p) => p.storagePath));
    console.log(`Removed ${photos.length} photo(s) from Supabase Storage.`);
  }

  const fishResult = await fishRepo.createQueryBuilder().delete().execute();
  console.log(`Deleted ${fishResult.affected ?? 0} fish observation(s) (photos cascade-deleted).`);

  const wqResult = await wqRepo.createQueryBuilder().delete().execute();
  console.log(`Deleted ${wqResult.affected ?? 0} water quality reading(s).`);

  const bathyResult = await bathyRepo.createQueryBuilder().delete().execute();
  console.log(`Deleted ${bathyResult.affected ?? 0} bathymetry survey(s).`);

  const logResult = await logRepo.createQueryBuilder().delete().execute();
  console.log(`Deleted ${logResult.affected ?? 0} activity log entr(y/ies).`);

  const userResult = await userRepo
    .createQueryBuilder()
    .delete()
    .where('role != :admin', { admin: UserRole.ADMIN })
    .execute();
  console.log(`Deleted ${userResult.affected ?? 0} non-admin user(s).`);

  const remainingUsers = await userRepo.find();
  console.log('\nRemaining users:', remainingUsers.map((u) => `${u.email} (${u.role})`).join(', '));

  await dataSource.destroy();
}

reset().catch((err: unknown) => {
  console.error('Reset failed:', err);
  process.exit(1);
});

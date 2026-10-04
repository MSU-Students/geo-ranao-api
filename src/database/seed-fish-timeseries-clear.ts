import dataSource from './data-source';
import { UserEntity } from '../users/entities/user.entity';
import { FishObservationEntity } from '../fish-observations/entities/fish-observation.entity';
import { FishObservationPhotoEntity } from '../fish-observations/entities/fish-observation-photo.entity';

// Refuse to run in production without explicit flag
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SAMPLE_SEED !== 'true') {
  console.error('ERROR: Refusing to run seed:fish-timeseries:clear in production unless ALLOW_SAMPLE_SEED=true');
  process.exit(1);
}

async function clearSampleData() {
  await dataSource.initialize();
  console.log('--- Clearing Sample Fish Time-Series Data ---');

  const photoRepo = dataSource.getRepository(FishObservationPhotoEntity);
  const fishRepo = dataSource.getRepository(FishObservationEntity);
  const userRepo = dataSource.getRepository(UserEntity);

  // Find sample records
  const sampleRecords = await fishRepo.createQueryBuilder('f')
    .where("f.notes LIKE '[SAMPLE DATA]%'")
    .getMany();

  if (sampleRecords.length > 0) {
    const recordIds = sampleRecords.map((r) => r.id);
    
    // Delete photo rows attached to sample records
    const photoResult = await photoRepo.createQueryBuilder()
      .delete()
      .where('"observationId" IN (:...ids)', { ids: recordIds })
      .execute();
    console.log(`Deleted ${photoResult.affected ?? 0} sample photo row(s).`);

    // Delete sample records
    const fishResult = await fishRepo.createQueryBuilder()
      .delete()
      .where("notes LIKE '[SAMPLE DATA]%'")
      .execute();
    console.log(`Deleted ${fishResult.affected ?? 0} sample fish observation record(s).`);
  } else {
    console.log('No sample fish observation records found to delete.');
  }

  // Delete sample researcher user
  const userResult = await userRepo.createQueryBuilder()
    .delete()
    .where("email = :email", { email: 'sample.researcher@example.invalid' })
    .execute();
  console.log(`Deleted ${userResult.affected ?? 0} sample researcher user(s).`);

  console.log('--- Sample Fish Data Clear Complete ---\n');
  await dataSource.destroy();
}

clearSampleData().catch((err) => {
  console.error('seed:fish-timeseries:clear failed:', err);
  process.exit(1);
});

import { DataSource } from 'typeorm';
import { resolveDataSourceOptions } from './typeorm.config';
import { UserEntity } from '../users/entities/user.entity';
import { ActivityLogEntity } from '../activity-log/entities/activity-log.entity';
import { StationEntity } from '../stations/entities/station.entity';
import { FishObservationEntity } from '../fish-observations/entities/fish-observation.entity';
import { FishObservationPhotoEntity } from '../fish-observations/entities/fish-observation-photo.entity';
import { WaterQualityReadingEntity } from '../water-quality/entities/water-quality-reading.entity';
import { BathymetrySurveyEntity } from '../bathymetry/entities/bathymetry-survey.entity';

// Used by the TypeORM CLI (`yarn typeorm`, `yarn migration:*`) and the seed
// script — anything that runs outside Nest's DI container, where
// autoLoadEntities in database.module.ts isn't resolvable.
export default new DataSource(
  resolveDataSourceOptions(
    [
      UserEntity,
      ActivityLogEntity,
      StationEntity,
      FishObservationEntity,
      FishObservationPhotoEntity,
      WaterQualityReadingEntity,
      BathymetrySurveyEntity,
    ],
    [__dirname + '/migrations/*{.ts,.js}'],
  ),
);

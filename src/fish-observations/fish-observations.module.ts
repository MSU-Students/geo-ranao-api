import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FishObservationEntity } from './entities/fish-observation.entity';
import { FishObservationPhotoEntity } from './entities/fish-observation-photo.entity';
import { FishObservationsService } from './fish-observations.service';
import { FishObservationsController } from './fish-observations.controller';
import { UsersModule } from '../users/users.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FishObservationEntity, FishObservationPhotoEntity]),
    UsersModule,
    ActivityLogModule,
    StorageModule,
  ],
  providers: [FishObservationsService],
  controllers: [FishObservationsController],
})
export class FishObservationsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BathymetrySurveyEntity } from './entities/bathymetry-survey.entity';
import { BathymetrySoundingEntity } from './entities/bathymetry-sounding.entity';
import { BathymetryPointEntity } from './entities/bathymetry-point.entity';
import { BathymetryService } from './bathymetry.service';
import { BathymetryController } from './bathymetry.controller';
import { BathymetryPointsController } from './bathymetry-points.controller';
import { UsersModule } from '../users/users.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BathymetrySurveyEntity, BathymetrySoundingEntity, BathymetryPointEntity]),
    UsersModule,
    ActivityLogModule,
  ],
  providers: [BathymetryService],
  controllers: [BathymetryController, BathymetryPointsController],
})
export class BathymetryModule {}

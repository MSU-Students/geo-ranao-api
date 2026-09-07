import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BathymetrySurveyEntity } from './entities/bathymetry-survey.entity';
import { BathymetryService } from './bathymetry.service';
import { BathymetryController } from './bathymetry.controller';
import { UsersModule } from '../users/users.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([BathymetrySurveyEntity]), UsersModule, ActivityLogModule],
  providers: [BathymetryService],
  controllers: [BathymetryController],
})
export class BathymetryModule {}

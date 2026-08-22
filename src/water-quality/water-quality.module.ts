import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaterQualityReadingEntity } from './entities/water-quality-reading.entity';
import { WaterQualityService } from './water-quality.service';
import { WaterQualityController } from './water-quality.controller';
import { StationsModule } from '../stations/stations.module';
import { UsersModule } from '../users/users.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaterQualityReadingEntity]),
    StationsModule,
    UsersModule,
    ActivityLogModule,
  ],
  providers: [WaterQualityService],
  controllers: [WaterQualityController],
})
export class WaterQualityModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { StationsModule } from './stations/stations.module';
import { FishObservationsModule } from './fish-observations/fish-observations.module';
import { WaterQualityModule } from './water-quality/water-quality.module';
import { BathymetryModule } from './bathymetry/bathymetry.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    ActivityLogModule,
    StationsModule,
    FishObservationsModule,
    WaterQualityModule,
    BathymetryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

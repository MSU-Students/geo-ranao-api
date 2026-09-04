import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolveDataSourceOptions } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...resolveDataSourceOptions([], [__dirname + '/migrations/*{.ts,.js}']),
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}

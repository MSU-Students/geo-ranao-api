import 'dotenv/config';
import { DataSourceOptions } from 'typeorm';

/**
 * Shared connection resolution for both the Nest runtime (database.module.ts)
 * and the standalone TypeORM CLI (data-source.ts, seed.ts).
 *
 * DATABASE_URL (Supabase/production) always wins over the discrete DB_* vars
 * (local Docker Postgres) so the same code/migrations work in both places.
 */
export function resolveDataSourceOptions(
  entities: NonNullable<DataSourceOptions['entities']>,
  migrations: NonNullable<DataSourceOptions['migrations']>,
): DataSourceOptions {
  const useSsl = process.env.DB_SSL === 'true';

  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      synchronize: false,
      entities,
      migrations,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'georanao',
    password: process.env.DB_PASSWORD ?? 'georanao_dev_password',
    database: process.env.DB_NAME ?? 'geo_ranao',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    synchronize: false,
    entities,
    migrations,
  };
}

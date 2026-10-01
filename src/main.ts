import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';

// Falls back to the documented local-dev frontend URL, not `true` (which
// would reflect *any* request origin back as allowed) — a FRONTEND_URL
// that's merely unset should still mean "only this one known dev origin,"
// not "every origin," especially paired with credentials: true below.
const LOCAL_DEV_FRONTEND_URL = 'http://localhost:9000';

// Supports a comma-separated list — e.g. a production URL plus a Vercel
// preview-deployment URL — rather than forcing exactly one allowed origin.
// Also warns (doesn't block startup) if NODE_ENV=production but the
// configured origin(s) still look like localhost, since that mistake
// otherwise fails silently: every request from the real deployed frontend
// just gets rejected by CORS with no obvious error pointing back to this.
function resolveCorsOrigins(configService: ConfigService): string[] {
  const raw =
    configService.get<string>('FRONTEND_URL') ?? LOCAL_DEV_FRONTEND_URL;
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isProduction =
    (configService.get<string>('NODE_ENV') ?? '').toLowerCase() ===
    'production';
  const stillLocalhost = origins.some(
    (o) => o.includes('localhost') || o.includes('127.0.0.1'),
  );
  if (isProduction && stillLocalhost) {
    new Logger('Bootstrap').warn(
      `NODE_ENV=production but FRONTEND_URL ("${raw}") still points at localhost — ` +
        'the real deployed frontend will be blocked by CORS until this is set to its actual URL.',
    );
  }
  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Default Express JSON body limit is 100kb — a bathymetry survey upload
  // (raw depth soundings before server-side snapping to the fixed grid,
  // see BathymetryService.create) can legitimately be much larger than
  // that. 50mb comfortably covers even a very large raw survey while still
  // being a real ceiling, not unlimited.
  app.useBodyParser('json', { limit: '50mb' });

  const config = new DocumentBuilder()
    .setTitle('Geo Ranao API')
    .setDescription('Auth, researcher accounts, and field data for the Geo Ranao project')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: resolveCorsOrigins(configService),
    credentials: true,
  });
  SwaggerModule.setup('api', app, documentFactory);
  await app.listen(configService.get<string>('PORT') ?? 3333);
}
bootstrap();

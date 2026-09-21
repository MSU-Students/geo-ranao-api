import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

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
    origin: configService.get<string>('FRONTEND_URL') ?? true,
    credentials: true,
  });
  SwaggerModule.setup('api', app, documentFactory);
  await app.listen(configService.get<string>('PORT') ?? 3333);
}
bootstrap();

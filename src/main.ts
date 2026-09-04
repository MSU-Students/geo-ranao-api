import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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

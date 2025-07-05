import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    origin: configService.get('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Set global prefix
  app.setGlobalPrefix('api');

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const port = configService.get('PORT', 3001);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📝 API documentation available at http://localhost:${port}/api`);
}

void bootstrap();

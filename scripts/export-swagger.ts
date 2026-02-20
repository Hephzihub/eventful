// scripts/export-swagger.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';

async function exportSwagger() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const config = new DocumentBuilder()
    .setTitle('Events API')
    .setDescription('API for creating and managing events')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  fs.mkdirSync('./exports', { recursive: true });
  fs.writeFileSync('./exports/swagger.json', JSON.stringify(document, null, 2));

  console.log('Swagger exported to ./exports/swagger.json');
  await app.close();
}

exportSwagger();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Eventful API')
    .setDescription('API documentation for the Eventful application')
    .setVersion('1.0')
    .addTag('events')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
  })
  app.enableCors()
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();

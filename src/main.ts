import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Eventful API')
    .setDescription('API documentation for the Eventful application')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('Authentication')
    .addTag('Events')
    .addTag('Tickets')
    .addTag('Payments')
    .addTag('Webhooks')
    .build();
    
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
    })
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  app.enableCors()
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();

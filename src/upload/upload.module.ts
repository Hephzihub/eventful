import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'nestjs-cloudinary';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadService } from './upload.service';

@Module({
  imports: [
    CloudinaryModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
        api_key: config.get('CLOUDINARY_API_KEY'),
        api_secret: config.get('CLOUDINARY_API_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
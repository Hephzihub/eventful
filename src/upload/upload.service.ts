import { Injectable, BadRequestException } from '@nestjs/common';
import { CloudinaryService } from 'nestjs-cloudinary';

@Injectable()
export class UploadService {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  async uploadEventImage(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    const result = await this.cloudinaryService.uploadFile(file, {
      folder: 'events',
      transformation: [
        { width: 1280, height: 720, crop: 'limit' },
        { quality: 'auto' },
        { fetch_format: 'auto' },
      ],
    });

    return result.secure_url;
  }

  async deleteImage(publicId: string): Promise<void> {
    await this.cloudinaryService.cloudinary.uploader.destroy(publicId);
  }
}
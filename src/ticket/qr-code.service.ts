import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class QrCodeService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly secretKey: Buffer;
  private readonly iv: Buffer;

  constructor(private configService: ConfigService) {
    // Use JWT_SECRET as base for encryption key
    const secret = this.configService.get<string>('JWT_SECRET') || 'default-secret-key';
    
    // Create 32-byte key from secret
    this.secretKey = crypto.scryptSync(secret, 'salt', 32);
    
    // Create 16-byte IV (initialization vector)
    this.iv = crypto.randomBytes(16);
  }

  /**
   * Generate encrypted QR code data for a ticket
   * Returns encrypted string to be stored in ticket.qrCode.data
   */
  generateQRCodeData(ticketId: string, eventId: string): string {
    const payload = {
      ticketId,
      eventId,
      timestamp: Date.now(),
    };

    const payloadString = JSON.stringify(payload);
    
    // Encrypt the payload
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, this.iv);
    let encrypted = cipher.update(payloadString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data (IV needed for decryption)
    const combined = this.iv.toString('hex') + ':' + encrypted;
    
    return combined;
  }

  /**
   * Decrypt QR code data to extract ticket information
   * Returns the original payload
   */
  decryptQRCode(encryptedData: string): {
    ticketId: string;
    eventId: string;
    timestamp: number;
  } {
    try {
      // Split IV and encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid QR code format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      // Decrypt
      const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Parse payload
      const payload = JSON.parse(decrypted);

      return payload;
    } catch (error) {
      throw new Error('Invalid or corrupted QR code');
    }
  }

  /**
   * Generate QR code image as base64 string
   * This can be displayed directly or sent via email
   */
  async generateQRCodeImage(data: string): Promise<string> {
    try {
      // Generate QR code as base64 data URL
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'H', // High error correction
        type: 'image/png',
        width: 300,
        margin: 2,
      });

      return qrCodeDataUrl;
    } catch (error) {
      throw new Error('Failed to generate QR code image');
    }
  }

  /**
   * Verify QR code is valid and not expired
   * QR codes don't expire, but we validate the structure
   */
  verifyQRCode(encryptedData: string): boolean {
    try {
      const payload = this.decryptQRCode(encryptedData);
      
      // Verify required fields exist
      if (!payload.ticketId || !payload.eventId || !payload.timestamp) {
        return false;
      }

      // Verify timestamp is reasonable (not from future)
      if (payload.timestamp > Date.now()) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}

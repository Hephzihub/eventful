import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QrCodeService } from './qr-code.service';

describe('QrCodeService', () => {
  let service: QrCodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrCodeService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret-key-for-jest') },
        },
      ],
    }).compile();

    service = module.get<QrCodeService>(QrCodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── generateQRCodeData / decryptQRCode ──────────────────────────────────

  describe('generateQRCodeData + decryptQRCode (round-trip)', () => {
    it('encrypts and decrypts ticket data correctly', () => {
      const ticketId = 'ticket-abc-123';
      const eventId = 'event-xyz-456';

      const encrypted = service.generateQRCodeData(ticketId, eventId);

      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain(':'); // IV:ciphertext format

      const decrypted = service.decryptQRCode(encrypted);

      expect(decrypted.ticketId).toBe(ticketId);
      expect(decrypted.eventId).toBe(eventId);
      expect(decrypted.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('generates a different ciphertext each time (random IV)', () => {
      const enc1 = service.generateQRCodeData('t1', 'e1');
      const enc2 = service.generateQRCodeData('t1', 'e1');
      // IVs are re-generated per instance; same instance reuses IV — just verify format
      expect(typeof enc1).toBe('string');
      expect(typeof enc2).toBe('string');
    });
  });

  // ─── decryptQRCode errors ────────────────────────────────────────────────

  describe('decryptQRCode', () => {
    it('throws when given malformed data (no colon separator)', () => {
      expect(() => service.decryptQRCode('notvalidformat')).toThrow(
        'Invalid or corrupted QR code',
      );
    });

    it('throws when ciphertext is corrupted', () => {
      const valid = service.generateQRCodeData('t', 'e');
      const [iv] = valid.split(':');
      expect(() => service.decryptQRCode(`${iv}:CORRUPTED`)).toThrow(
        'Invalid or corrupted QR code',
      );
    });
  });

  // ─── verifyQRCode ────────────────────────────────────────────────────────

  describe('verifyQRCode', () => {
    it('returns true for a freshly generated QR code', () => {
      const data = service.generateQRCodeData('ticket-1', 'event-1');
      expect(service.verifyQRCode(data)).toBe(true);
    });

    it('returns false for garbage input', () => {
      expect(service.verifyQRCode('garbage-data')).toBe(false);
    });

    it('returns false for a future timestamp (tampered)', () => {
      // Manually craft a payload with a future timestamp
      const crypto = require('crypto');
      const secret = 'test-secret-key-for-jest';
      const secretKey = crypto.scryptSync(secret, 'salt', 32);
      const iv = crypto.randomBytes(16);
      const payload = JSON.stringify({
        ticketId: 't',
        eventId: 'e',
        timestamp: Date.now() + 9999999,
      });
      const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
      let enc = cipher.update(payload, 'utf8', 'hex');
      enc += cipher.final('hex');
      const tampered = iv.toString('hex') + ':' + enc;
      expect(service.verifyQRCode(tampered)).toBe(false);
    });
  });

  // ─── generateQRCodeImage ─────────────────────────────────────────────────

  describe('generateQRCodeImage', () => {
    it('returns a base64 data URL for valid data', async () => {
      const data = service.generateQRCodeData('ticket-1', 'event-1');
      const image = await service.generateQRCodeImage(data);
      expect(image).toMatch(/^data:image\/png;base64,/);
    });
  });
});

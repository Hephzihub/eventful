import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaystackService', () => {
  let service: PaystackService;
  let axiosInstanceMock: { post: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    axiosInstanceMock = { post: jest.fn(), get: jest.fn() };
    mockedAxios.create.mockReturnValue(axiosInstanceMock as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaystackService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'PAYSTACK_SECRET_KEY') return 'sk_test_secret';
              if (key === 'PAYSTACK_PUBLIC_KEY') return 'pk_test_public';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaystackService>(PaystackService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── verifyWebhookSignature ──────────────────────────────────────────────

  describe('verifyWebhookSignature', () => {
    it('returns true for a valid HMAC-SHA512 signature', () => {
      const crypto = require('crypto');
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'REF-1' } });
      const signature = crypto
        .createHmac('sha512', 'sk_test_secret')
        .update(payload)
        .digest('hex');

      expect(service.verifyWebhookSignature(payload, signature)).toBe(true);
    });

    it('returns false when signature does not match', () => {
      const payload = JSON.stringify({ event: 'charge.success' });
      expect(service.verifyWebhookSignature(payload, 'bad-signature')).toBe(false);
    });

    it('returns false when payload is tampered', () => {
      const crypto = require('crypto');
      const original = JSON.stringify({ event: 'charge.success', data: { amount: 1000 } });
      const signature = crypto.createHmac('sha512', 'sk_test_secret').update(original).digest('hex');
      const tampered = JSON.stringify({ event: 'charge.success', data: { amount: 9999999 } });

      expect(service.verifyWebhookSignature(tampered, signature)).toBe(false);
    });
  });

  // ─── initializeTransaction ───────────────────────────────────────────────

  describe('initializeTransaction', () => {
    it('returns authorization_url, access_code, reference on success', async () => {
      axiosInstanceMock.post.mockResolvedValue({
        data: {
          status: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/abc',
            access_code: 'access-123',
            reference: 'EVT-REF-1',
          },
        },
      });

      const result = await service.initializeTransaction(
        'buyer@example.com',
        1025000,
        'EVT-REF-1',
        'http://localhost:3000/verify',
      );

      expect(result.authorization_url).toBe('https://checkout.paystack.com/abc');
      expect(result.access_code).toBe('access-123');
    });

    it('throws BadRequestException when Paystack returns status:false', async () => {
      axiosInstanceMock.post.mockResolvedValue({
        data: { status: false, message: 'Invalid key' },
      });

      await expect(
        service.initializeTransaction('a@b.com', 1000, 'REF', 'http://cb'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on network error', async () => {
      const err: any = new Error('Network Error');
      err.isAxiosError = true;
      err.response = { data: { message: 'Connection refused' } };
      mockedAxios.isAxiosError.mockReturnValue(true);
      axiosInstanceMock.post.mockRejectedValue(err);

      await expect(
        service.initializeTransaction('a@b.com', 1000, 'REF', 'http://cb'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── verifyTransaction ───────────────────────────────────────────────────

  describe('verifyTransaction', () => {
    it('returns transaction details on success', async () => {
      axiosInstanceMock.get.mockResolvedValue({
        data: {
          status: true,
          data: {
            status: 'success',
            amount: 1025000,
            paid_at: '2025-01-01T10:00:00.000Z',
            channel: 'card',
            currency: 'NGN',
            authorization: { authorization_code: 'AUTH_abc', card_type: 'visa', last4: '4242' },
            customer: { email: 'buyer@example.com' },
            metadata: {},
          },
        },
      });

      const result = await service.verifyTransaction('EVT-REF-1');

      expect(result.status).toBe('success');
      expect(result.channel).toBe('card');
      expect(result.authorization.last4).toBe('4242');
    });

    it('throws BadRequestException when Paystack returns status:false', async () => {
      axiosInstanceMock.get.mockResolvedValue({
        data: { status: false, message: 'Transaction not found' },
      });

      await expect(service.verifyTransaction('BAD-REF')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── processRefund ───────────────────────────────────────────────────────

  describe('processRefund', () => {
    it('returns refund data on success', async () => {
      axiosInstanceMock.post.mockResolvedValue({
        data: { status: true, data: { id: 'refund-id-1', status: 'pending' } },
      });

      const result = await service.processRefund('EVT-REF-1', 1025000, 'User requested');
      expect(result.id).toBe('refund-id-1');
    });

    it('throws BadRequestException on failure', async () => {
      axiosInstanceMock.post.mockResolvedValue({
        data: { status: false, message: 'Refund failed' },
      });

      await expect(service.processRefund('EVT-REF-1')).rejects.toThrow(BadRequestException);
    });
  });
});

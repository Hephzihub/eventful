import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

const mockPaymentService = {
  initiatePayment: jest.fn(),
  verifyPayment: jest.fn(),
  getUserPayments: jest.fn(),
  getPaymentById: jest.fn(),
  getEventRevenue: jest.fn(),
  getCreatorAnalytics: jest.fn(),
};

describe('PaymentController', () => {
  let controller: PaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiatePayment', () => {
    it('delegates to paymentService.initiatePayment', async () => {
      const user = { _id: 'uid-1' };
      const dto = { eventId: 'eid', tierId: 'tid', quantity: 1, email: 'a@b.com' };
      const expected = { paymentUrl: 'https://checkout.paystack.com/abc', reference: 'ref' };
      mockPaymentService.initiatePayment.mockResolvedValue(expected);
      const result = await controller.initiatePayment(user, dto as any);
      expect(mockPaymentService.initiatePayment).toHaveBeenCalledWith('uid-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('verifyPayment', () => {
    it('delegates to paymentService.verifyPayment', async () => {
      const user = { _id: 'uid-1' };
      const expected = { status: 'success', amount: 10250 };
      mockPaymentService.verifyPayment.mockResolvedValue(expected);
      const result = await controller.verifyPayment('EVT-123-ABC', user);
      expect(mockPaymentService.verifyPayment).toHaveBeenCalledWith('EVT-123-ABC', 'uid-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getUserPayments', () => {
    it('delegates to paymentService.getUserPayments', async () => {
      const user = { _id: 'uid-1' };
      mockPaymentService.getUserPayments.mockResolvedValue({ payments: [], pagination: {} });
      const result = await controller.getUserPayments(user, {} as any);
      expect(mockPaymentService.getUserPayments).toHaveBeenCalledWith('uid-1', {});
      expect(result.payments).toEqual([]);
    });
  });

  describe('getEventRevenue', () => {
    it('delegates to paymentService.getEventRevenue', async () => {
      const user = { _id: 'creator-id-1' };
      const expected = { overall: { totalRevenue: 100000 }, byTier: [] };
      mockPaymentService.getEventRevenue.mockResolvedValue(expected);
      const result = await controller.getEventRevenue('event-id-1', user);
      expect(mockPaymentService.getEventRevenue).toHaveBeenCalledWith('event-id-1', 'creator-id-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getCreatorAnalytics', () => {
    it('delegates to paymentService.getCreatorAnalytics', async () => {
      const user = { _id: 'creator-id-1' };
      const expected = { totals: { revenue: 0 }, eventCount: 0, byEvent: [] };
      mockPaymentService.getCreatorAnalytics.mockResolvedValue(expected);
      const result = await controller.getCreatorAnalytics(user);
      expect(mockPaymentService.getCreatorAnalytics).toHaveBeenCalledWith('creator-id-1');
      expect(result).toEqual(expected);
    });
  });
});

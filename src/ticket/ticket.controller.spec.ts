import { Test, TestingModule } from '@nestjs/testing';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';

const mockTicketService = {
  validateTicketPurchase: jest.fn(),
  getUserTickets: jest.fn(),
  getTicketById: jest.fn(),
  getTicketQRCodeImage: jest.fn(),
  cancelTicket: jest.fn(),
  scanTicket: jest.fn(),
  getEventTickets: jest.fn(),
  getTicketStats: jest.fn(),
  setUserReminders: jest.fn(),
  clearUserReminders: jest.fn(),
  getUserReminders: jest.fn(),
};

describe('TicketController', () => {
  let controller: TicketController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketController],
      providers: [{ provide: TicketService, useValue: mockTicketService }],
    }).compile();

    controller = module.get<TicketController>(TicketController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('validatePurchase', () => {
    it('delegates to ticketService.validateTicketPurchase', async () => {
      const user = { _id: 'uid-1' };
      const dto = { eventId: 'eid', tierId: 'tid', quantity: 1 };
      mockTicketService.validateTicketPurchase.mockResolvedValue({ subtotal: 5000 });
      const result = await controller.validatePurchase(user, dto as any);
      expect(mockTicketService.validateTicketPurchase).toHaveBeenCalledWith('uid-1', dto);
      expect(result).toBeDefined();
    });
  });

  describe('getUserTickets', () => {
    it('delegates to ticketService.getUserTickets', async () => {
      const user = { _id: 'uid-1' };
      mockTicketService.getUserTickets.mockResolvedValue({ tickets: [], pagination: {} });
      const result = await controller.getUserTickets(user, {} as any);
      expect(mockTicketService.getUserTickets).toHaveBeenCalledWith('uid-1', {});
      expect(result.tickets).toEqual([]);
    });
  });

  describe('scanTicket', () => {
    it('delegates to ticketService.scanTicket with qrCodeData', async () => {
      const user = { _id: 'creator-1' };
      const scanDto = { qrCodeData: 'encrypted-qr' };
      mockTicketService.scanTicket.mockResolvedValue({ success: true });
      const result = await controller.scanTicket(scanDto as any, user);
      expect(mockTicketService.scanTicket).toHaveBeenCalledWith('encrypted-qr', 'creator-1');
      expect(result.success).toBe(true);
    });
  });

  describe('setUserReminders', () => {
    it('delegates to ticketService.setUserReminders', async () => {
      const user = { _id: 'uid-1' };
      mockTicketService.setUserReminders.mockResolvedValue({
        message: 'Reminders set successfully',
        ticketId: 'ticket-id-1',
        intervals: [168, 24],
      });
      const result = await controller.setUserReminders('ticket-id-1', user, [168, 24]);
      expect(mockTicketService.setUserReminders).toHaveBeenCalledWith('ticket-id-1', 'uid-1', [168, 24]);
      expect(result.intervals).toEqual([168, 24]);
    });
  });

  describe('clearUserReminders', () => {
    it('delegates to ticketService.clearUserReminders', async () => {
      const user = { _id: 'uid-1' };
      mockTicketService.clearUserReminders.mockResolvedValue({
        message: 'Reminders cleared',
        ticketId: 'ticket-id-1',
      });
      const result = await controller.clearUserReminders('ticket-id-1', user);
      expect(mockTicketService.clearUserReminders).toHaveBeenCalledWith('ticket-id-1', 'uid-1');
      expect(result.message).toBe('Reminders cleared');
    });
  });

  describe('cancelTicket', () => {
    it('delegates to ticketService.cancelTicket', async () => {
      const user = { _id: 'uid-1' };
      mockTicketService.cancelTicket.mockResolvedValue({
        message: 'Ticket cancelled successfully. Refund will be processed.',
        ticket: {},
      });
      const result = await controller.cancelTicket('ticket-id-1', user);
      expect(mockTicketService.cancelTicket).toHaveBeenCalledWith('ticket-id-1', 'uid-1');
      expect(result.message).toContain('cancelled');
    });
  });
});

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly secretKey: string;
  private readonly publicKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    this.publicKey = this.configService.get<string>('PAYSTACK_PUBLIC_KEY') || '';

    if (!this.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    // Create axios instance with Paystack config
    this.axiosInstance = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });
  }

  /**
   * Initialize a payment transaction
   * Amount should be in kobo (multiply NGN by 100)
   */
  async initializeTransaction(
    email: string,
    amount: number,
    reference: string,
    callbackUrl: string,
    metadata?: any,
  ): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }> {
    try {
      this.logger.log(`Initializing transaction: ${reference} for ${amount} kobo`);

      const response = await this.axiosInstance.post('/transaction/initialize', {
        email,
        amount: Math.round(amount), // Ensure integer (kobo)
        reference,
        callback_url: callbackUrl,
        metadata: {
          ...metadata,
          custom_fields: [
            {
              display_name: 'Event Tickets',
              variable_name: 'event_tickets',
              value: metadata?.quantity || 1,
            },
          ],
        },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      });

      if (!response.data.status) {
        throw new BadRequestException(
          response.data.message || 'Failed to initialize transaction',
        );
      }

      this.logger.log(`Transaction initialized successfully: ${reference}`);

      return {
        authorization_url: response.data.data.authorization_url,
        access_code: response.data.data.access_code,
        reference: response.data.data.reference,
      };
    } catch (error) {
      this.logger.error(`Failed to initialize transaction: ${error.message}`);
      
      if (axios.isAxiosError(error) && error.response) {
        throw new BadRequestException(
          error.response.data?.message || 'Payment initialization failed',
        );
      }

      throw new BadRequestException('Payment initialization failed');
    }
  }

  /**
   * Verify a transaction
   * Returns payment details from Paystack
   */
  async verifyTransaction(reference: string): Promise<{
    status: string;
    amount: number;
    paid_at: string;
    channel: string;
    currency: string;
    authorization?: any;
    customer?: any;
    metadata?: any;
  }> {
    try {
      this.logger.log(`Verifying transaction: ${reference}`);

      const response = await this.axiosInstance.get(
        `/transaction/verify/${reference}`,
      );

      if (!response.data.status) {
        throw new BadRequestException(
          response.data.message || 'Transaction verification failed',
        );
      }

      const data = response.data.data;

      this.logger.log(`Transaction verified: ${reference} - Status: ${data.status}`);

      return {
        status: data.status,
        amount: data.amount,
        paid_at: data.paid_at,
        channel: data.channel,
        currency: data.currency,
        authorization: data.authorization,
        customer: data.customer,
        metadata: data.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to verify transaction: ${error.message}`);

      if (axios.isAxiosError(error) && error.response) {
        throw new BadRequestException(
          error.response.data?.message || 'Transaction verification failed',
        );
      }

      throw new BadRequestException('Transaction verification failed');
    }
  }

  /**
   * Process a refund
   * Amount in kobo (if not provided, full refund)
   */
  async processRefund(
    transactionReference: string,
    amount?: number,
    customerNote?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Processing refund for: ${transactionReference}`);

      const payload: any = {
        transaction: transactionReference,
      };

      if (amount) {
        payload.amount = Math.round(amount); // Kobo
      }

      if (customerNote) {
        payload.customer_note = customerNote;
      }

      const response = await this.axiosInstance.post('/refund', payload);

      if (!response.data.status) {
        throw new BadRequestException(
          response.data.message || 'Refund processing failed',
        );
      }

      this.logger.log(`Refund processed successfully: ${transactionReference}`);

      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to process refund: ${error.message}`);

      if (axios.isAxiosError(error) && error.response) {
        throw new BadRequestException(
          error.response.data?.message || 'Refund processing failed',
        );
      }

      throw new BadRequestException('Refund processing failed');
    }
  }

  /**
   * Verify webhook signature
   * Critical for security
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');

    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: number): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/transaction/${transactionId}`);

      if (!response.data.status) {
        throw new BadRequestException('Failed to fetch transaction');
      }

      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to get transaction: ${error.message}`);
      throw new BadRequestException('Failed to fetch transaction details');
    }
  }
}

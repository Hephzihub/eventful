import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { PaystackService } from './paystack.service';
import { Public } from '../auth/decorators/public.decorators';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Webhooks')
@SkipThrottle()
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly paystackService: PaystackService,
  ) {}

  @Public()
  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Paystack webhook endpoint',
    description:
      'Receives payment notifications from Paystack. Signature verification is required. This endpoint is public (no authentication) but secured by webhook signature.',
  })
  @ApiHeader({
    name: 'x-paystack-signature',
    description: 'Paystack webhook signature for verification',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid webhook signature',
  })
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
    @Body() body: any,
  ) {
    this.logger.log('Paystack webhook received');

    // Verify webhook signature (CRITICAL FOR SECURITY)
    if (!signature) {
      this.logger.error('Missing webhook signature');
      throw new UnauthorizedException('Missing webhook signature');
    }

    // Get raw body for signature verification
    const rawBody = req.rawBody?.toString() || JSON.stringify(body);

    const isValid = this.paystackService.verifyWebhookSignature(
      rawBody,
      signature,
    );

    if (!isValid) {
      this.logger.error('Invalid webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log('Webhook signature verified');

    // Extract event and data
    const { event, data } = body;

    this.logger.log(`Webhook event: ${event}, Reference: ${data?.reference}`);

    // Process webhook
    try {
      await this.paymentService.handleWebhook(event, data);
      this.logger.log(`Webhook processed successfully: ${event}`);
    } catch (error) {
      // Log error but still return 200 OK
      // Paystack will retry if we return error status
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
    }

    // ALWAYS return 200 OK to Paystack
    // Even if processing fails, we return success to prevent retries
    // Failed webhooks should be handled via manual review
    return {
      status: 'success',
      message: 'Webhook received',
    };
  }
}

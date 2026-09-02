export interface MonoResponse {
  invoiceId: string;
  pageUrl: string;
}

export interface MonobankWebhookBody {
  invoiceId: string;
  status: 'created' | 'processing' | 'hold' | 'success' | 'failure' | 'reversed' | 'expired';
  reference?: string;
  amount?: number;
  finalAmount?: number;
  ccy?: number;
  paymentInfo?: Record<string, unknown>;
}

export interface PaymentRequest {
  amount: number;
  name: string;
  phone: string;
  email: string;
  orderId?: string;
  comment?: string;
  utm?: Record<string, string>;
  metadata?: Record<string, unknown>;
  goods: Array<{
    code: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  shipping?: {
    type: 'ukraine' | 'international';
    city?: string;
    address?: string;
    postcode?: string;
    country?: string;
    warehouse?: string;
  };
}

import { z } from 'zod';

const stringish = z.union([z.string(), z.number()]).optional();

export const checkoutPayloadSchema = z.object({
  locale: z.string().optional(),
  payment_type: z.enum(['full', 'prepayment', 'installments']).default('full'),
  installments_parts_count: stringish,
  amount: stringish,
  cart_total: stringish,
  cart_token: z.string().optional(),
  customer: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }).default({}),
  shipping_type: z.enum(['ukraine', 'international']).default('ukraine'),
  shipping: z.object({
    type: z.enum(['ukraine', 'international']).optional(),
    delivery_method: z.enum(['branch', 'postomat', 'address']).optional(),
    city: z.string().optional(),
    city_ref: z.string().optional(),
    warehouse: z.string().optional(),
    warehouse_ref: z.string().optional(),
    street: z.string().optional(),
    house: z.string().optional(),
    apartment: z.string().optional(),
    country: z.string().optional(),
    intl_city: z.string().optional(),
    address: z.string().optional(),
    postcode: z.string().optional(),
    shipping_price: stringish,
  }).default({}),
  goods: z.array(z.object({
    code: stringish,
    variant_id: stringish,
    variant_title: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    price: stringish,
    quantity: stringish,
    properties: z.array(z.object({
      name: z.string().optional(),
      value: stringish,
    })).optional(),
  })).default([]),
  comment: z.string().optional(),
  personal_data_consent: z.boolean().optional(),
  tracking: z.record(z.unknown()).optional(),
  utm: z.record(z.unknown()).optional(),
});

export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;

export type PaymentType = 'full' | 'prepayment' | 'installments';

export interface StoredPaymentMetadata {
  shopifyOrderId: number;
  shopifyOrderName?: string;
  reference: string;
  amount: number;
  paymentType: PaymentType;
  customer: CheckoutPayload['customer'];
  tracking: Record<string, unknown>;
  cartTotal: number;
  goods?: CheckoutPayload['goods'];
}

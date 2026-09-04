import { describe, expect, test } from 'bun:test';
import { checkoutPayloadSchema } from '../../lib/types/checkout';

const basePayload = {
  payment_type: 'full',
  amount: 1200,
  cart_total: 1200,
  customer: {
    first_name: 'Анастасія',
    last_name: 'Зінчук',
    phone: '+380682345729',
    email: 'test@example.com',
  },
  shipping_type: 'ukraine',
  shipping: {
    type: 'ukraine',
    delivery_method: 'branch',
    city: 'Київ',
    warehouse: 'Відділення №12',
  },
  goods: [
    {
      variant_id: 111,
      name: 'Сукня',
      price: 1200,
      quantity: 1,
    },
  ],
};

describe('checkout payload validation', () => {
  test('requires customer email', () => {
    expect(checkoutPayloadSchema.safeParse({
      ...basePayload,
      customer: {
        first_name: 'Анастасія',
        last_name: 'Зінчук',
        phone: '+380682345729',
        email: '',
      },
    }).success).toBe(false);

    expect(checkoutPayloadSchema.safeParse({
      ...basePayload,
      customer: {
        first_name: 'Анастасія',
        last_name: 'Зінчук',
        phone: '+380682345729',
      },
    }).success).toBe(false);
  });

  test('accepts valid customer email', () => {
    const parsed = checkoutPayloadSchema.parse({
      ...basePayload,
      customer: {
        ...basePayload.customer,
        email: '  test@example.com  ',
      },
    });

    expect(parsed.customer.email).toBe('test@example.com');
  });
});

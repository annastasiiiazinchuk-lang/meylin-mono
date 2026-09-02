export interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
  expires_in: number;
}

export interface ShopifyErrorResponse {
  error: string;
  error_description?: string;
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  variant_id?: number;
  product_id?: number;
  sku?: string;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  email?: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: ShopifyLineItem[];
  note_attributes?: Array<{ name?: string; value?: string }>;
  created_at: string;
  updated_at: string;
  subtotal_price?: string;
  total_tax?: string;
  shipping_address?: {
    first_name: string;
    last_name: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    zip: string;
    phone?: string;
  };
}

export interface CachedToken {
  token: string;
  expiresAt: number;
}

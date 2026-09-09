import { env } from "../../config/env";
import type { StoredPaymentMetadata } from "../../types/checkout";
import type { MonobankWebhookBody } from "../../types/monobank";
import { asNumber, asString, sha256 } from "../../utils/format";

type MetaPurchasePayload = {
  data: Array<Record<string, unknown>>;
};

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  );
}

export function normalizeMetaPhone(value: unknown): string {
  const digits = asString(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `38${digits}`;
  return digits;
}

export function buildMetaPurchasePayload(
  payment: StoredPaymentMetadata,
  webhookBody: MonobankWebhookBody,
): MetaPurchasePayload {
  const customer = payment.customer || {};
  const tracking = payment.tracking || {};
  const goods = Array.isArray(payment.goods) ? payment.goods : [];

  const eventId = `mono_${asString(webhookBody.invoiceId) || Date.now()}`;
  const paidAmount =
    asNumber(webhookBody.finalAmount || webhookBody.amount) / 100 ||
    asNumber(payment.amount);
  const orderValue = asNumber(payment.cartTotal) || paidAmount;

  const contents = goods.map((item) => ({
    id: String(item.code || item.variant_id || ""),
    quantity: Number(item.quantity || 1),
    item_price: Number(item.price || 0),
  }));

  const payload = {
    data: [
      compactRecord({
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: asString(tracking.page_url || tracking.landing_page || tracking.referrer),
        user_data: compactRecord({
          em: sha256(customer.email),
          ph: sha256(normalizeMetaPhone(customer.phone)),
          fn: sha256(customer.first_name),
          ln: sha256(customer.last_name),
          fbp: asString(tracking.fbp),
          fbc: asString(tracking.fbc),
          client_user_agent: asString(tracking.user_agent),
          client_ip_address: asString(tracking.client_ip_address || tracking.ip_address),
        }),
        custom_data: compactRecord({
          currency: "UAH",
          value: orderValue,
          order_id: asString(
            payment.shopifyOrderName || payment.shopifyOrderId,
          ),
          content_type: "product",
          content_ids: contents.map((item) => item.id).filter(Boolean),
          contents,
          content_name: goods
            .map((item) => item.name)
            .filter(Boolean)
            .join(", "),
          num_items: contents.reduce((sum, item) => sum + item.quantity, 0),
        }),
      }),
    ],
  };

  return payload;
}

export async function sendMetaPurchaseEvent(
  payment: StoredPaymentMetadata,
  webhookBody: MonobankWebhookBody,
): Promise<void> {
  if (!env.metaPixelId || !env.metaAccessToken) return;

  const payload = buildMetaPurchasePayload(payment, webhookBody);

  const response = await fetch(
    `https://graph.facebook.com/${env.metaGraphVersion}/${env.metaPixelId}/events?access_token=${encodeURIComponent(env.metaAccessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  const text = await response.text();
  if (!response.ok)
    throw new Error(`Meta CAPI error ${response.status}: ${text}`);
  console.log("Meta Purchase sent:", text);
}

import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { json, paystackRequest, supabaseAdmin, paystackSecretKey } from '../../../lib/paystack';

type PaystackEvent = {
  event: string;
  data: { reference?: string; status?: string };
};

type PaystackVerifyResponse = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  customer: { email: string };
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';
    const expected = crypto.createHmac('sha512', paystackSecretKey).update(rawBody).digest('hex');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return json({ error: 'Invalid signature.' }, 401);
    }

    const event = JSON.parse(rawBody) as PaystackEvent;
    if (event.event !== 'charge.success' || !event.data.reference) return json({ received: true });

    const reference = event.data.reference;
    const { data: order } = await supabaseAdmin
      .from('book_orders')
      .select('id, amount_ngn, customer_email, status')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (!order || order.status === 'PAID') return json({ received: true });

    const payment = await paystackRequest<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(reference)}`
    );

    const valid =
      payment.status === 'success' &&
      payment.currency === 'NGN' &&
      payment.amount === Math.round(Number(order.amount_ngn) * 100) &&
      payment.customer.email.toLowerCase() === order.customer_email.toLowerCase();

    await supabaseAdmin
      .from('book_orders')
      .update({ status: valid ? 'PAID' : 'FAILED', paid_at: valid ? new Date().toISOString() : null })
      .eq('id', order.id)
      .neq('status', 'PAID');

    return json({ received: true });
  } catch {
    return json({ error: 'Webhook processing failed.' }, 500);
  }
};

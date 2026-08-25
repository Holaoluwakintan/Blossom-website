import type { APIRoute } from 'astro';
import { json, paystackRequest, supabaseAdmin } from '../../../lib/paystack';

type PaystackVerifyResponse = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  customer: { email: string };
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const reference = String(body.reference || '').trim();
    if (!reference) return json({ error: 'Payment reference is required.' }, 400);

    const { data: order, error: orderError } = await supabaseAdmin
      .from('book_orders')
      .select('id, book_id, customer_email, amount_ngn, status, paystack_reference')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (orderError) return json({ error: orderError.message }, 500);
    if (!order) return json({ error: 'Order not found.' }, 404);

    const payment = await paystackRequest<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(reference)}`
    );

    const expectedAmountKobo = Math.round(Number(order.amount_ngn) * 100);
    const paidCorrectly =
      payment.status === 'success' &&
      payment.currency === 'NGN' &&
      payment.amount === expectedAmountKobo &&
      payment.customer.email.toLowerCase() === order.customer_email.toLowerCase();

    if (!paidCorrectly) {
      await supabaseAdmin
        .from('book_orders')
        .update({ status: 'FAILED' })
        .eq('id', order.id)
        .neq('status', 'PAID');
      return json({ error: 'Payment could not be verified.' }, 402);
    }

    const { data: book, error: bookError } = await supabaseAdmin
      .from('books')
      .select('id, title, download_path')
      .eq('id', order.book_id)
      .maybeSingle();

    if (bookError) return json({ error: bookError.message }, 500);
    if (!book?.download_path) return json({ error: 'The paid download is not available yet.' }, 409);

    const { error: updateError } = await supabaseAdmin
      .from('book_orders')
      .update({ status: 'PAID', paid_at: new Date().toISOString() })
      .eq('id', order.id)
      .neq('status', 'PAID');

    if (updateError) return json({ error: updateError.message }, 500);

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from('digital-books')
      .createSignedUrl(book.download_path, 60 * 60);

    if (signedError || !signed?.signedUrl) {
      return json({ error: signedError?.message || 'Unable to prepare download.' }, 500);
    }

    return json({
      success: true,
      title: book.title,
      download_url: signed.signedUrl,
      expires_in_seconds: 60 * 60
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to verify payment.' }, 500);
  }
};

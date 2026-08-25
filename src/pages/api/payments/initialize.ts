import type { APIRoute } from 'astro';
import { json, paystackRequest, siteUrl, supabaseAdmin } from '../../../lib/paystack';

type PaystackInitializeResponse = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const bookId = String(body.bookId || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!bookId || !email || !emailPattern.test(email)) {
      return json({ error: 'A valid book and email address are required.' }, 400);
    }

    const { data: book, error: bookError } = await supabaseAdmin
      .from('books')
      .select('id, title, price_ngn, download_path')
      .eq('id', bookId)
      .maybeSingle();

    if (bookError) return json({ error: bookError.message }, 500);
    if (!book) return json({ error: 'Book not found.' }, 404);

    const amountNgn = Number(book.price_ngn);
    if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
      return json({ error: 'This book is not available for paid checkout.' }, 400);
    }

    if (!book.download_path) {
      return json({ error: 'This digital book is not ready for secure delivery yet.' }, 409);
    }

    const reference = `blossom-${book.id}-${Date.now()}`;
    const payment = await paystackRequest<PaystackInitializeResponse>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email,
        amount: Math.round(amountNgn * 100),
        currency: 'NGN',
        reference,
        callback_url: `${siteUrl}/payment/success?reference=${encodeURIComponent(reference)}`,
        metadata: {
          book_id: book.id,
          book_title: book.title,
          customer_email: email
        }
      })
    });

    const { error: orderError } = await supabaseAdmin.from('book_orders').insert({
      book_id: book.id,
      customer_email: email,
      amount_ngn: Math.round(amountNgn),
      paystack_reference: payment.reference,
      status: 'PENDING'
    });

    if (orderError) return json({ error: orderError.message }, 500);

    return json({ authorization_url: payment.authorization_url, reference: payment.reference });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to start payment.' }, 500);
  }
};

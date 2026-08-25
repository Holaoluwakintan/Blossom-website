import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

const clean = (value: unknown, maxLength: number) =>
  String(value ?? '')
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .slice(0, maxLength);

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    if (payload.website_url) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const bookId = clean(payload.book_id, 80);
    const reviewerName = clean(payload.reviewer_name, 80);
    const reviewerEmail = clean(payload.reviewer_email, 160).toLowerCase();
    const reviewTitle = clean(payload.review_title, 120);
    const reviewBody = clean(payload.review_body, 2000);
    const rating = Number(payload.rating);

    if (!bookId || !reviewerName || !reviewBody || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Please provide your name, rating, and review.' }), { status: 400 });
    }

    if (reviewerEmail && !/^\S+@\S+\.\S+$/.test(reviewerEmail)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), { status: 400 });
    }

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id')
      .eq('id', bookId)
      .maybeSingle();

    if (bookError || !book) {
      return new Response(JSON.stringify({ error: 'That book could not be found.' }), { status: 404 });
    }

    const { error } = await supabase.from('book_reviews').insert({
      book_id: bookId,
      rating,
      review_title: reviewTitle || null,
      review_body: reviewBody,
      reviewer_name: reviewerName,
      reviewer_email: reviewerEmail || null,
      status: 'PUBLISHED',
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch {
    return new Response(JSON.stringify({ error: 'Review could not be published.' }), { status: 500 });
  }
};

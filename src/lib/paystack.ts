import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://rlbrhpjljjgpqpqjrpkc.supabase.co';
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || 'placeholder-service-key', {
  auth: { autoRefreshToken: false, persistSession: false }
});

export const paystackSecretKey = import.meta.env.PAYSTACK_SECRET_KEY || '';

export const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://olaoluwamichael.vercel.app';

export async function paystackRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!paystackSecretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  const payload = await response.json();
  if (!response.ok || payload.status === false) {
    throw new Error(payload.message || `Paystack request failed with ${response.status}`);
  }

  return payload.data as T;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}


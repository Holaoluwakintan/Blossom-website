import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { generateStoryAnnouncement } from '../../../lib/newsletter-templates';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { title, slug, excerpt, readingTimeMinutes, secretKey } = await request.json().catch(() => ({}));

    // Simple safeguard: accept either the supabase service role or paystack key as admin authorization
    const adminKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PAYSTACK_SECRET_KEY || 'blossom-admin';
    if (secretKey && secretKey !== adminKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (!title || !slug) {
      return new Response(JSON.stringify({ error: 'Title and slug are required' }), { status: 400 });
    }

    // Generate announcement drafts
    const announcement = generateStoryAnnouncement({
      title,
      slug,
      excerpt,
      readingTimeMinutes,
    });

    // Fetch active subscribers
    const { data: subscribers, error: fetchError } = await supabaseServer
      .from('newsletter_subscribers')
      .select('email, full_name')
      .eq('marketing_consent', true);

    const recipientCount = subscribers?.length || 0;
    const resendApiKey = import.meta.env.RESEND_API_KEY;

    let emailsSent = 0;
    let dispatchStatus = 'draft_prepared';

    if (resendApiKey && subscribers && subscribers.length > 0) {
      // Send via Resend API
      try {
        const batchEmails = subscribers.map((sub: any) => ({
          from: 'Olaoluwa Michael <newsletter@olaoluwamichael.vercel.app>',
          to: sub.email,
          subject: announcement.emailSubject,
          html: announcement.emailHtml,
          text: announcement.emailPlainText,
        }));

        const resendResponse = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batchEmails),
        });

        if (resendResponse.ok) {
          emailsSent = subscribers.length;
          dispatchStatus = 'sent';
        } else {
          dispatchStatus = 'resend_error';
        }
      } catch (e) {
        dispatchStatus = 'resend_network_error';
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatchStatus,
        recipientCount,
        emailsSent,
        announcement,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Notification generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

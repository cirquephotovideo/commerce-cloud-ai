import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeyStatus {
  name: string;
  envVar: string;
  configured: boolean;
  valid: boolean;
  service: string;
  lastTested: string;
  error?: string;
}

async function verifyGoogleSearchAPI(apiKey: string, cx: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=test&num=1`
    );
    return { valid: response.ok };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function verifyStripeAPI(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
    });
    await stripe.accounts.retrieve();
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function verifyResendAPI(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    return { valid: response.ok };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function verifySerperAPI(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: 'test' }),
    });
    return { valid: response.ok };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function verifySupabaseURL(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${url}/rest/v1/`);
    return { valid: response.status === 401 || response.status === 200 }; // 401 means it's working but needs auth
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[VERIFY-API-KEYS] Starting verification');

    const keys: KeyStatus[] = [];
    const now = new Date().toISOString();

    // Google Search API
    const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const googleCx = Deno.env.get('GOOGLE_SEARCH_CX');
    if (googleApiKey && googleCx) {
      const result = await verifyGoogleSearchAPI(googleApiKey, googleCx);
      keys.push({
        name: 'Google Search API',
        envVar: 'GOOGLE_SEARCH_API_KEY',
        configured: true,
        valid: result.valid,
        service: 'Google Cloud',
        lastTested: now,
        error: result.error,
      });
      keys.push({
        name: 'Google Search CX',
        envVar: 'GOOGLE_SEARCH_CX',
        configured: true,
        valid: result.valid,
        service: 'Google Cloud',
        lastTested: now,
        error: result.error,
      });
    } else {
      keys.push({
        name: 'Google Search API',
        envVar: 'GOOGLE_SEARCH_API_KEY',
        configured: !!googleApiKey,
        valid: false,
        service: 'Google Cloud',
        lastTested: now,
      });
      keys.push({
        name: 'Google Search CX',
        envVar: 'GOOGLE_SEARCH_CX',
        configured: !!googleCx,
        valid: false,
        service: 'Google Cloud',
        lastTested: now,
      });
    }

    // Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (stripeKey) {
      const result = await verifyStripeAPI(stripeKey);
      keys.push({
        name: 'Stripe Secret',
        envVar: 'STRIPE_SECRET_KEY',
        configured: true,
        valid: result.valid,
        service: 'Stripe',
        lastTested: now,
        error: result.error,
      });
    } else {
      keys.push({
        name: 'Stripe Secret',
        envVar: 'STRIPE_SECRET_KEY',
        configured: false,
        valid: false,
        service: 'Stripe',
        lastTested: now,
      });
    }

    // Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const result = await verifyResendAPI(resendKey);
      keys.push({
        name: 'Resend API',
        envVar: 'RESEND_API_KEY',
        configured: true,
        valid: result.valid,
        service: 'Resend',
        lastTested: now,
        error: result.error,
      });
    } else {
      keys.push({
        name: 'Resend API',
        envVar: 'RESEND_API_KEY',
        configured: false,
        valid: false,
        service: 'Resend',
        lastTested: now,
      });
    }

    // Serper
    const serperKey = Deno.env.get('SERPER_API_KEY');
    if (serperKey) {
      const result = await verifySerperAPI(serperKey);
      keys.push({
        name: 'Serper API',
        envVar: 'SERPER_API_KEY',
        configured: true,
        valid: result.valid,
        service: 'Serper',
        lastTested: now,
        error: result.error,
      });
    } else {
      keys.push({
        name: 'Serper API',
        envVar: 'SERPER_API_KEY',
        configured: false,
        valid: false,
        service: 'Serper',
        lastTested: now,
      });
    }

    // Lovable API
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    keys.push({
      name: 'Lovable API',
      envVar: 'LOVABLE_API_KEY',
      configured: !!lovableKey,
      valid: !!lovableKey,
      service: 'Lovable',
      lastTested: now,
    });

    // Supabase keys
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (supabaseUrl) {
      const result = await verifySupabaseURL(supabaseUrl);
      keys.push({
        name: 'Supabase URL',
        envVar: 'SUPABASE_URL',
        configured: true,
        valid: result.valid,
        service: 'Supabase',
        lastTested: now,
        error: result.error,
      });
    } else {
      keys.push({
        name: 'Supabase URL',
        envVar: 'SUPABASE_URL',
        configured: false,
        valid: false,
        service: 'Supabase',
        lastTested: now,
      });
    }

    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    keys.push({
      name: 'Supabase Anon Key',
      envVar: 'SUPABASE_ANON_KEY',
      configured: !!supabaseAnonKey,
      valid: !!supabaseAnonKey,
      service: 'Supabase',
      lastTested: now,
    });

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    keys.push({
      name: 'Supabase Service Role Key',
      envVar: 'SUPABASE_SERVICE_ROLE_KEY',
      configured: !!supabaseServiceKey,
      valid: !!supabaseServiceKey,
      service: 'Supabase',
      lastTested: now,
    });

    const supabasePublishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    keys.push({
      name: 'Supabase Publishable Key',
      envVar: 'SUPABASE_PUBLISHABLE_KEY',
      configured: !!supabasePublishableKey,
      valid: !!supabasePublishableKey,
      service: 'Supabase',
      lastTested: now,
    });

    const supabaseDbUrl = Deno.env.get('SUPABASE_DB_URL');
    keys.push({
      name: 'Supabase DB URL',
      envVar: 'SUPABASE_DB_URL',
      configured: !!supabaseDbUrl,
      valid: !!supabaseDbUrl,
      service: 'Supabase',
      lastTested: now,
    });

    console.log(`[VERIFY-API-KEYS] Verified ${keys.length} keys`);

    return new Response(JSON.stringify({ keys }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VERIFY-API-KEYS] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

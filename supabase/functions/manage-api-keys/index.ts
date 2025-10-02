import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestKeyRequest {
  service: string;
  key?: string;
  cx?: string;
  url?: string;
}

// Verify functions for each service
async function verifyGoogleSearchAPI(apiKey: string, cx: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=test`,
      { method: 'GET' }
    );
    if (response.ok) {
      return { valid: true };
    }
    const error = await response.text();
    return { valid: false, error: `Invalid API key or CX: ${error}` };
  } catch (error) {
    const err = error as Error;
    return { valid: false, error: `Connection error: ${err.message}` };
  }
}

async function verifyStripeAPI(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.stripe.com/v1/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    if (response.ok) {
      return { valid: true };
    }
    const error = await response.json();
    return { valid: false, error: error.error?.message || 'Invalid Stripe key' };
  } catch (error) {
    const err = error as Error;
    return { valid: false, error: `Connection error: ${err.message}` };
  }
}

async function verifyResendAPI(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    if (response.ok || response.status === 200) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid Resend API key' };
  } catch (error) {
    const err = error as Error;
    return { valid: false, error: `Connection error: ${err.message}` };
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
    if (response.ok) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid Serper API key' };
  } catch (error) {
    const err = error as Error;
    return { valid: false, error: `Connection error: ${err.message}` };
  }
}

async function verifySupabaseURL(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.ok || response.status === 404) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid Supabase URL' };
  } catch (error) {
    const err = error as Error;
    return { valid: false, error: `Connection error: ${err.message}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, service, key, cx, url } = await req.json() as TestKeyRequest & { action: string };

    console.log(`[MANAGE-API-KEYS] Action: ${action}, Service: ${service}`);

    if (action === 'test') {
      let result: { valid: boolean; error?: string };

      switch (service) {
        case 'Google Search':
          if (!key || !cx) {
            return new Response(
              JSON.stringify({ valid: false, error: 'API key and CX are required' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          result = await verifyGoogleSearchAPI(key, cx);
          break;

        case 'Stripe':
          if (!key) {
            return new Response(
              JSON.stringify({ valid: false, error: 'API key is required' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          result = await verifyStripeAPI(key);
          break;

        case 'Resend':
          if (!key) {
            return new Response(
              JSON.stringify({ valid: false, error: 'API key is required' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          result = await verifyResendAPI(key);
          break;

        case 'Serper':
          if (!key) {
            return new Response(
              JSON.stringify({ valid: false, error: 'API key is required' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          result = await verifySerperAPI(key);
          break;

        case 'Supabase':
          if (!url) {
            return new Response(
              JSON.stringify({ valid: false, error: 'URL is required' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          result = await verifySupabaseURL(url);
          break;

        default:
          return new Response(
            JSON.stringify({ valid: false, error: 'Unknown service' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[MANAGE-API-KEYS] Error:', error);
    const err = error as Error;
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function testGoogleSearch(apiKey: string, cx: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=test`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        valid: false, 
        error: errorData.error?.message || `HTTP ${response.status}` 
      };
    }
    
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function testSerper(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    console.log('[SERPER-TEST] Testing Serper API key...');
    
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        q: 'test',
        gl: 'fr',
        hl: 'fr'
      }),
    });

    console.log('[SERPER-TEST] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SERPER-TEST] Error response:', errorText);
      
      // Serper returns 401 or 403 for invalid/unauthorized keys
      if (response.status === 401 || response.status === 403) {
        console.log('[SERPER-TEST] Authentication failed with status:', response.status);
        return { valid: false, error: 'Clé API invalide ou non autorisée' };
      }
      
      // Try to parse error message
      try {
        const errorData = JSON.parse(errorText);
        return { 
          valid: false, 
          error: errorData.message || `HTTP ${response.status}` 
        };
      } catch {
        return { valid: false, error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` };
      }
    }

    const data = await response.json();
    console.log('[SERPER-TEST] Success! Response contains:', Object.keys(data));
    
    // Serper should return organic results or similar
    if (!data.organic && !data.searchParameters) {
      return { valid: false, error: 'Réponse API inattendue' };
    }

    return { valid: true };
  } catch (error) {
    console.error('[SERPER-TEST] Exception:', error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function testStripe(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Test with Stripe API - list balance to verify key
    const response = await fetch('https://api.stripe.com/v1/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        valid: false, 
        error: errorData.error?.message || `HTTP ${response.status}` 
      };
    }

    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function testResend(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Test with Resend API - list domains endpoint (doesn't send email)
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        valid: false, 
        error: errorData.message || `HTTP ${response.status}` 
      };
    }

    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function testSupabase(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
    });
    
    // A 401 or 403 is actually OK - it means the URL is valid but auth is required
    if (response.status === 401 || response.status === 403 || response.ok) {
      return { valid: true };
    }

    return { 
      valid: false, 
      error: `HTTP ${response.status}` 
    };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, service, key, cx, url } = await req.json();

    console.log(`[MANAGE-API-KEYS] Action: ${action}, Service: ${service}`);

    if (action === 'test') {
      let result;

      switch (service) {
        case 'Google Search':
          if (!key || !cx) {
            result = { valid: false, error: 'API Key et CX requis' };
          } else {
            result = await testGoogleSearch(key, cx);
          }
          break;

        case 'Serper':
          if (!key) {
            result = { valid: false, error: 'API Key requise' };
          } else {
            result = await testSerper(key);
          }
          break;

        case 'Stripe':
          if (!key) {
            result = { valid: false, error: 'Secret Key requise' };
          } else {
            result = await testStripe(key);
          }
          break;

        case 'Resend':
          if (!key) {
            result = { valid: false, error: 'API Key requise' };
          } else {
            result = await testResend(key);
          }
          break;

        case 'Supabase':
          if (!url) {
            result = { valid: false, error: 'URL Supabase requise' };
          } else {
            result = await testSupabase(url);
          }
          break;

        default:
          result = { valid: false, error: 'Service non supporté' };
      }

      console.log(`[MANAGE-API-KEYS] Test result for ${service}:`, result);

      return new Response(
        JSON.stringify(result),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Action non supportée' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );

  } catch (error) {
    console.error('[MANAGE-API-KEYS] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

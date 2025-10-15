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

async function testSerper(apiKey: string, useSaved = false): Promise<{ 
  valid: boolean; 
  error?: string; 
  statusCode?: number; 
  rawMessage?: string; 
  hints?: string[];
  tested?: Array<{ source: string; valid: boolean; statusCode?: number; error?: string }>;
}> {
  try {
    console.log('[SERPER-TEST] Testing Serper API key...');
    
    // Sanitize the key
    const sanitizedKey = apiKey?.trim();
    
    // Validate format (64 hex characters)
    const serperKeyPattern = /^[A-Fa-f0-9]{64}$/;
    if (sanitizedKey && !serperKeyPattern.test(sanitizedKey)) {
      return { 
        valid: false, 
        error: 'Format de clé Serper inattendu',
        hints: ['Vérifiez que vous avez bien collé la clé API (64 caractères hexadécimaux).']
      };
    }
    
    // Check for internal spaces
    if (sanitizedKey && sanitizedKey !== apiKey) {
      console.warn('[SERPER-TEST] Key contained whitespace');
    }
    
    // Handle saved key testing
    const savedKey = Deno.env.get('SERPER_API_KEY');
    
    if (useSaved && !sanitizedKey && savedKey) {
      // Test saved key only
      return await performSerperTest(savedKey, 'saved');
    }
    
    if (useSaved && sanitizedKey && savedKey && sanitizedKey !== savedKey) {
      // Test both keys and return comparison
      const typedResult = await performSerperTest(sanitizedKey, 'typed');
      const savedResult = await performSerperTest(savedKey, 'saved');
      
      return {
        valid: typedResult.valid || savedResult.valid,
        error: typedResult.valid ? undefined : (savedResult.valid ? undefined : 'Les deux clés ont échoué'),
        tested: [
          { source: 'typed', valid: typedResult.valid, statusCode: typedResult.statusCode, error: typedResult.error },
          { source: 'saved', valid: savedResult.valid, statusCode: savedResult.statusCode, error: savedResult.error }
        ]
      };
    }
    
    // Test provided key
    return await performSerperTest(sanitizedKey || savedKey || '', sanitizedKey ? 'typed' : 'saved');
    
  } catch (error) {
    console.error('[SERPER-TEST] Exception:', error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      hints: ['Une erreur inattendue s\'est produite lors du test.']
    };
  }
}

async function performSerperTest(key: string, source: string): Promise<{
  valid: boolean;
  error?: string;
  statusCode?: number;
  rawMessage?: string;
  hints?: string[];
}> {
  console.log(`[SERPER-TEST] Testing ${source} key...`);
  
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      q: 'test',
      gl: 'fr',
      hl: 'fr'
    }),
  });

  console.log(`[SERPER-TEST] Response status for ${source}:`, response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[SERPER-TEST] Error response for ${source}:`, errorText);
    
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      // Not JSON
    }
    
    const rawMessage = errorData.message || errorText.substring(0, 100);
    
    // Handle specific status codes
    if (response.status === 401 || response.status === 403) {
      console.log(`[SERPER-TEST] Authentication failed for ${source} with status:`, response.status);
      return { 
        valid: false, 
        error: 'Clé API invalide ou non autorisée',
        statusCode: response.status,
        rawMessage,
        hints: ['Vérifiez que votre clé API Serper est correcte et active.']
      };
    }
    
    if (response.status === 429) {
      return {
        valid: false,
        error: 'Rate limit atteint ou compte non autorisé pour ce plan',
        statusCode: response.status,
        rawMessage,
        hints: ['Vérifiez votre plan Serper et vos limites d\'utilisation.']
      };
    }
    
    return { 
      valid: false, 
      error: errorData.message || `HTTP ${response.status}`,
      statusCode: response.status,
      rawMessage
    };
  }

  const data = await response.json();
  console.log(`[SERPER-TEST] Success for ${source}! Response contains:`, Object.keys(data));
  
  // Serper should return organic results or similar
  if (!data.organic && !data.searchParameters) {
    return { 
      valid: false, 
      error: 'Réponse API inattendue',
      hints: ['L\'API a répondu mais sans les données attendues.']
    };
  }

  return { valid: true };
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
    const { action, service, key, cx, url, useSaved } = await req.json();

    console.log(`[MANAGE-API-KEYS] Action: ${action}, Service: ${service}`);

    if (action === 'test') {
      let result;

      switch (service) {
        case 'Google Search':
          if (!key || !cx) {
            result = { valid: false, error: 'API Key et CX requis' };
          } else {
            result = await testGoogleSearch(key.trim(), cx.trim());
          }
          break;

        case 'Serper':
          result = await testSerper(key?.trim() || '', useSaved);
          break;

        case 'Stripe':
          if (!key) {
            result = { valid: false, error: 'Secret Key requise' };
          } else {
            result = await testStripe(key.trim());
          }
          break;

        case 'Resend':
          if (!key) {
            result = { valid: false, error: 'API Key requise' };
          } else {
            result = await testResend(key.trim());
          }
          break;

        case 'Supabase':
          if (!url) {
            result = { valid: false, error: 'URL Supabase requise' };
          } else {
            result = await testSupabase(url.trim());
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

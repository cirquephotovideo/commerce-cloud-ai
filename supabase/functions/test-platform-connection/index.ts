import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { handleError, ErrorCode } from '../_shared/error-handler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface TestConnectionRequest {
  platform_type: string;
  platform_url: string;
  credentials: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: req.headers.get('Authorization')! },
    },
  });

  try {
    const { platform_type, platform_url, credentials }: TestConnectionRequest = await req.json();
    
    console.log(`[TEST-CONNECTION] Testing ${platform_type} connection to:`, platform_url);

    let testResult = { success: false, message: '', details: {} };

    // Test connection based on platform type
    switch (platform_type) {
      case 'odoo':
        testResult = await testOdooConnection(platform_url, credentials);
        break;
      case 'prestashop':
        testResult = await testPrestashopConnection(platform_url, credentials);
        break;
      case 'woocommerce':
        testResult = await testWooCommerceConnection(platform_url, credentials);
        break;
      case 'shopify':
        testResult = await testShopifyConnection(platform_url, credentials);
        break;
      case 'magento':
        testResult = await testMagentoConnection(platform_url, credentials);
        break;
      default:
        throw new Error(`Unsupported platform type: ${platform_type}`);
    }

    console.log(`[TEST-CONNECTION] Result for ${platform_type}:`, testResult.success ? 'SUCCESS' : 'FAILED');

    return new Response(
      JSON.stringify(testResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: testResult.success ? 200 : 400
      }
    );

  } catch (error) {
    console.error('[TEST-CONNECTION] Error:', error);
    return handleError(error, 'test-platform-connection', corsHeaders);
  }
});

async function testOdooConnection(baseUrl: string, credentials: Record<string, string>) {
  const { database, username, password } = credentials;
  
  if (!database || !username || !password) {
    return {
      success: false,
      message: 'Missing required credentials: database, username, or password',
      details: {}
    };
  }

  // Build XML-RPC endpoint candidates (same logic as import-from-odoo)
  const buildXmlRpcCandidates = (url: string): string[] => {
    try {
      const urlObj = new URL(url);
      const origin = urlObj.origin;
      const path = urlObj.pathname;
      
      const candidates: string[] = [];
      
      // Priority 1: Origin root (most common)
      candidates.push(`${origin}/xmlrpc/2`);
      
      // Priority 2: With /odoo prefix
      if (!path.includes('/odoo')) {
        candidates.push(`${origin}/odoo/xmlrpc/2`);
      }
      
      // Priority 3: Use configured path if exists and different
      if (path && path !== '/' && !candidates.includes(`${origin}${path}/xmlrpc/2`)) {
        candidates.push(`${origin}${path}/xmlrpc/2`);
      }
      
      return candidates;
    } catch (e) {
      return [`${url}/xmlrpc/2`];
    }
  };

  const endpoints = buildXmlRpcCandidates(baseUrl);
  console.log('[ODOO-TEST] XML-RPC endpoint candidates:', endpoints);

  let lastError = '';
  
  for (const baseEndpoint of endpoints) {
    try {
      console.log(`[ODOO-TEST] Trying endpoint: ${baseEndpoint}`);
      
      // Step 1: Authenticate using XML-RPC
      const authPayload = `<?xml version="1.0"?>
        <methodCall>
          <methodName>authenticate</methodName>
          <params>
            <param><string>${database}</string></param>
            <param><string>${username}</string></param>
            <param><string>${password}</string></param>
            <param><struct></struct></param>
          </params>
        </methodCall>`;

      const authResponse = await fetch(`${baseEndpoint}/common`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: authPayload,
      });

      const authText = await authResponse.text();
      
      // Check for HTML response (wrong endpoint)
      if (authText.includes('<!doctype html>') || authText.includes('<html')) {
        lastError = 'Wrong endpoint (got HTML response)';
        console.log(`[ODOO-TEST] ${lastError} at ${baseEndpoint}`);
        continue;
      }

      if (!authResponse.ok) {
        lastError = `Authentication failed (HTTP ${authResponse.status})`;
        console.log(`[ODOO-TEST] ${lastError} at ${baseEndpoint}`);
        continue;
      }

      // Parse XML-RPC response
      const uidMatch = authText.match(/<int>(\d+)<\/int>/);
      const uid = uidMatch ? parseInt(uidMatch[1], 10) : null;

      if (!uid || uid === 0) {
        lastError = 'Invalid credentials or authentication failed';
        console.log(`[ODOO-TEST] ${lastError}`);
        continue;
      }

      console.log(`[ODOO-TEST] ✓ Authentication successful at ${baseEndpoint} (UID: ${uid})`);

      // Step 2: Test access to product.template model
      const searchPayload = `<?xml version="1.0"?>
        <methodCall>
          <methodName>execute</methodName>
          <params>
            <param><string>${database}</string></param>
            <param><int>${uid}</int></param>
            <param><string>${password}</string></param>
            <param><string>product.template</string></param>
            <param><string>search_count</string></param>
            <param><array><data></data></array></param>
          </params>
        </methodCall>`;

      const testResponse = await fetch(`${baseEndpoint}/object`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: searchPayload,
      });

      if (!testResponse.ok) {
        lastError = `Product access test failed (HTTP ${testResponse.status})`;
        console.log(`[ODOO-TEST] ${lastError}`);
        continue;
      }

      const testText = await testResponse.text();
      const countMatch = testText.match(/<int>(\d+)<\/int>/);
      const productCount = countMatch ? parseInt(countMatch[1], 10) : 0;

      console.log(`[ODOO-TEST] ✓ Product access successful. Found ${productCount} products`);

      return {
        success: true,
        message: `Successfully connected to Odoo. Found ${productCount} product templates available for import.`,
        details: {
          endpoint: baseEndpoint,
          uid,
          productCount,
          database
        }
      };

    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.log(`[ODOO-TEST] Exception at ${baseEndpoint}:`, lastError);
      continue;
    }
  }

  return {
    success: false,
    message: `Connection test failed: ${lastError}`,
    details: { 
      attemptedEndpoints: endpoints,
      lastError 
    }
  };
}

async function testPrestashopConnection(baseUrl: string, credentials: Record<string, string>) {
  const { api_key } = credentials;
  
  if (!api_key) {
    return {
      success: false,
      message: 'Missing API key',
      details: {}
    };
  }

  try {
    const normalizedUrl = baseUrl.replace(/\/$/, '');
    const testUrl = `${normalizedUrl}/api`;
    
    const response = await fetch(testUrl, {
      headers: {
        'Authorization': `Basic ${btoa(api_key + ':')}`,
      }
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Successfully connected to PrestaShop',
        details: { endpoint: testUrl }
      };
    } else {
      return {
        success: false,
        message: `Connection failed (HTTP ${response.status})`,
        details: { endpoint: testUrl }
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      details: {}
    };
  }
}

async function testWooCommerceConnection(baseUrl: string, credentials: Record<string, string>) {
  const { consumer_key, consumer_secret } = credentials;
  
  if (!consumer_key || !consumer_secret) {
    return {
      success: false,
      message: 'Missing consumer key or secret',
      details: {}
    };
  }

  try {
    const normalizedUrl = baseUrl.replace(/\/$/, '');
    const testUrl = `${normalizedUrl}/wp-json/wc/v3/products?per_page=1`;
    
    const response = await fetch(testUrl, {
      headers: {
        'Authorization': `Basic ${btoa(consumer_key + ':' + consumer_secret)}`,
      }
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Successfully connected to WooCommerce',
        details: { endpoint: testUrl }
      };
    } else {
      return {
        success: false,
        message: `Connection failed (HTTP ${response.status})`,
        details: { endpoint: testUrl }
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      details: {}
    };
  }
}

async function testShopifyConnection(baseUrl: string, credentials: Record<string, string>) {
  const { access_token, shop_name } = credentials;
  
  if (!access_token || !shop_name) {
    return {
      success: false,
      message: 'Missing access token or shop name',
      details: {}
    };
  }

  try {
    const testUrl = `https://${shop_name}.myshopify.com/admin/api/2024-01/products.json?limit=1`;
    
    const response = await fetch(testUrl, {
      headers: {
        'X-Shopify-Access-Token': access_token,
      }
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Successfully connected to Shopify',
        details: { endpoint: testUrl }
      };
    } else {
      return {
        success: false,
        message: `Connection failed (HTTP ${response.status})`,
        details: { endpoint: testUrl }
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      details: {}
    };
  }
}

async function testMagentoConnection(baseUrl: string, credentials: Record<string, string>) {
  const { access_token } = credentials;
  
  if (!access_token) {
    return {
      success: false,
      message: 'Missing access token',
      details: {}
    };
  }

  try {
    const normalizedUrl = baseUrl.replace(/\/$/, '');
    const testUrl = `${normalizedUrl}/rest/V1/products?searchCriteria[pageSize]=1`;
    
    const response = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      }
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Successfully connected to Magento',
        details: { endpoint: testUrl }
      };
    } else {
      return {
        success: false,
        message: `Connection failed (HTTP ${response.status})`,
        details: { endpoint: testUrl }
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      details: {}
    };
  }
}

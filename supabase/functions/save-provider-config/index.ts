import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProviderTestResult {
  success: boolean;
  latency: number;
  error?: string;
  models?: string[];
}

async function testClaudeProvider(apiKey: string): Promise<ProviderTestResult> {
  const startTime = Date.now();
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Test' }],
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return { success: false, latency, error: `API Error: ${response.status}` };
    }

    return {
      success: true,
      latency,
      models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function testOpenAIProvider(apiKey: string): Promise<ProviderTestResult> {
  const startTime = Date.now();
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: 'Test' }],
        max_completion_tokens: 10,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return { success: false, latency, error: `API Error: ${response.status}` };
    }

    return {
      success: true,
      latency,
      models: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini'],
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function testOpenRouterProvider(apiKey: string): Promise<ProviderTestResult> {
  const startTime = Date.now();
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://your-app.com',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 10,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return { success: false, latency, error: `API Error: ${response.status}` };
    }

    return {
      success: true,
      latency,
      models: ['anthropic/claude-3.5-sonnet', 'google/gemini-pro-1.5', 'meta-llama/llama-3.1-70b'],
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function testHeyGenProvider(apiKey: string): Promise<ProviderTestResult> {
  const startTime = Date.now();
  try {
    const response = await fetch('https://api.heygen.com/v2/avatars', {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return { success: false, latency, error: `API Error: ${response.status}` };
    }

    const data = await response.json();
    const avatars = data.data?.avatars || [];

    return {
      success: true,
      latency,
      models: [`${avatars.length} avatars disponibles`],
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[SAVE-PROVIDER-CONFIG] Function started');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[SAVE-PROVIDER-CONFIG] Missing authorization header');
      throw new Error('Missing authorization header');
    }

    console.log('[SAVE-PROVIDER-CONFIG] Authenticating user...');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[SAVE-PROVIDER-CONFIG] Authentication failed:', authError);
      throw new Error('Unauthorized');
    }

    console.log(`[SAVE-PROVIDER-CONFIG] User authenticated: ${user.id} (${user.email})`);

    const { provider, api_key, model, priority = 0, test_only = false } = await req.json();

    console.log(`[SAVE-PROVIDER-CONFIG] Testing ${provider} for user ${user.id}`, {
      provider,
      test_only,
      has_api_key: !!api_key,
      model,
      priority
    });

    // Test the provider
    let testResult: ProviderTestResult;
    
    switch (provider) {
      case 'claude':
        testResult = await testClaudeProvider(api_key);
        break;
      case 'openai':
        testResult = await testOpenAIProvider(api_key);
        break;
      case 'openrouter':
        testResult = await testOpenRouterProvider(api_key);
        break;
      case 'heygen':
        testResult = await testHeyGenProvider(api_key);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    console.log(`[SAVE-PROVIDER-CONFIG] Test result for ${provider}:`, {
      success: testResult.success,
      latency: testResult.latency,
      models_count: testResult.models?.length || 0,
      error: testResult.error
    });

    if (!testResult.success) {
      console.error(`[SAVE-PROVIDER-CONFIG] Provider ${provider} test failed:`, testResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: testResult.error || 'Provider test failed',
          latency: testResult.latency 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If test_only, don't save
    if (test_only) {
      console.log(`[SAVE-PROVIDER-CONFIG] Test-only mode, skipping save`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          latency: testResult.latency,
          models: testResult.models 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[SAVE-PROVIDER-CONFIG] Saving configuration for ${provider}...`);

    // Save to ai_provider_configs
    const { error: configError } = await supabase
      .from('ai_provider_configs')
      .upsert({
        user_id: user.id,
        provider,
        api_key_encrypted: api_key,
        default_model: model,
        is_active: true,
        priority,
      }, { 
        onConflict: 'user_id,provider'
      });

    if (configError) {
      console.error(`[SAVE-PROVIDER-CONFIG] Config save failed:`, configError);
      throw configError;
    }

    console.log(`[SAVE-PROVIDER-CONFIG] Provider config saved`);

    // Update ai_provider_health
    const { error: healthError } = await supabase
      .from('ai_provider_health')
      .upsert({
        provider,
        status: 'online',
        response_time_ms: testResult.latency,
        available_models: testResult.models || [],
        last_check: new Date().toISOString(),
      }, { 
        onConflict: 'provider'
      });

    if (healthError) {
      console.error(`[SAVE-PROVIDER-CONFIG] Health save failed:`, healthError);
      throw healthError;
    }

    console.log(`[SAVE-PROVIDER-CONFIG] Provider health updated successfully`);

    return new Response(
      JSON.stringify({ 
        success: true,
        latency: testResult.latency,
        models: testResult.models
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SAVE-PROVIDER-CONFIG] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

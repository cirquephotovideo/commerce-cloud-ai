import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to log AI requests
async function logAIRequest(
  supabase: any,
  userId: string,
  provider: string,
  model: string,
  success: boolean,
  latencyMs: number,
  errorMessage?: string
) {
  try {
    await supabase.from('ai_request_logs').insert({
      user_id: userId,
      provider,
      model,
      success,
      latency_ms: latencyMs,
      error_message: errorMessage,
    });
  } catch (err) {
    console.error('[AI-LOG] Failed to log request:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  // Declare variables in outer scope for error logging
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  let model = 'claude-sonnet-4-20250514';

  try {
    console.log('[CLAUDE-PROXY] Function started');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Claude API key (user key or global fallback)
    let ANTHROPIC_API_KEY = null;
    
    const { data: userConfig } = await supabase
      .from('ai_provider_configs')
      .select('api_key_encrypted')
      .eq('provider', 'claude')
      .eq('is_active', true)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (userConfig) {
      ANTHROPIC_API_KEY = userConfig.api_key_encrypted;
    } else {
      const { data: globalConfig } = await supabase
        .from('ai_provider_configs')
        .select('api_key_encrypted')
        .eq('provider', 'claude')
        .eq('is_active', true)
        .is('user_id', null)
        .maybeSingle();
      
      if (globalConfig) {
        ANTHROPIC_API_KEY = globalConfig.api_key_encrypted;
      } else {
        ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
        if (ANTHROPIC_API_KEY) {
          console.warn('[CLAUDE-PROXY] Using env fallback');
        }
      }
    }
    
    if (!ANTHROPIC_API_KEY) {
      console.error('[CLAUDE-PROXY] API key not configured');
      return new Response(JSON.stringify({ error: 'Claude API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await req.json();
    model = requestBody.model || 'claude-sonnet-4-20250514';
    const { messages, max_tokens = 4096, testMode } = requestBody;
    
    // Mode test : retourner mock
    if (testMode) {
      console.log('[CLAUDE-PROXY] Test mode - returning mock response');
      return new Response(JSON.stringify({
        id: 'test-msg-id',
        content: [{ type: 'text', text: 'Test mode response' }],
        model: model,
        usage: { input_tokens: 0, output_tokens: 0 },
        testMode: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[CLAUDE-PROXY] Request:', { 
      model, 
      messageCount: messages?.length,
      max_tokens,
      timestamp: new Date().toISOString()
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[CLAUDE-PROXY] Error:', response.status, error);
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;
    
    // Log successful request
    await logAIRequest(supabase, user.id, 'claude', model, true, latency);
    
    console.log('[CLAUDE-PROXY] Success', {
      latency_ms: latency,
      usage: data.usage
    });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    
    // Log failed request
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logAIRequest(supabase, user.id, 'claude', model || 'unknown', false, latency, errorMessage);
      }
    } catch (logError) {
      console.error('[CLAUDE-PROXY] Failed to log error:', logError);
    }
    
    console.error('[CLAUDE-PROXY] Error:', {
      error: errorMessage,
      latency_ms: latency
    });
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
  let model = 'gpt-5-mini';

  try {
    console.log('[OPENAI-PROXY] Function started');

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

    // Get OpenAI API key (user key or global fallback)
    let OPENAI_API_KEY = null;
    
    const { data: userConfig } = await supabase
      .from('ai_provider_configs')
      .select('api_key_encrypted')
      .eq('provider', 'openai')
      .eq('is_active', true)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (userConfig) {
      OPENAI_API_KEY = userConfig.api_key_encrypted;
    } else {
      const { data: globalConfig } = await supabase
        .from('ai_provider_configs')
        .select('api_key_encrypted')
        .eq('provider', 'openai')
        .eq('is_active', true)
        .is('user_id', null)
        .maybeSingle();
      
      if (globalConfig) {
        OPENAI_API_KEY = globalConfig.api_key_encrypted;
      } else {
        OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (OPENAI_API_KEY) {
          console.warn('[OPENAI-PROXY] Using env fallback');
        }
      }
    }
    
    if (!OPENAI_API_KEY) {
      console.error('[OPENAI-PROXY] API key not configured');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await req.json();
    model = requestBody.model || 'gpt-5-mini';
    const { messages, max_completion_tokens, testMode } = requestBody;
    
    // Mode test
    if (testMode) {
      console.log('[OPENAI-PROXY] Test mode - returning mock response');
      return new Response(JSON.stringify({
        id: 'test-completion-id',
        choices: [{ message: { role: 'assistant', content: 'Test response' } }],
        model: model,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        testMode: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[OPENAI-PROXY] Request:', { 
      model, 
      messageCount: messages?.length,
      max_completion_tokens,
      timestamp: new Date().toISOString()
    });

    // Newer models (GPT-5+) use max_completion_tokens and don't support temperature
    const isNewerModel = model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4');
    
    const apiRequestBody: any = {
      model,
      messages,
    };

    if (isNewerModel) {
      if (max_completion_tokens) {
        apiRequestBody.max_completion_tokens = max_completion_tokens;
      }
    } else {
      // Legacy models support max_tokens and temperature
      if (max_completion_tokens) {
        apiRequestBody.max_tokens = max_completion_tokens;
      }
      apiRequestBody.temperature = 0.7;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OPENAI-PROXY] Error:', response.status, error);
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;
    
    // Log successful request
    await logAIRequest(supabase, user.id, 'openai', model, true, latency);
    
    console.log('[OPENAI-PROXY] Success', {
      latency_ms: latency,
      usage: data.usage,
      model: data.model
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
        await logAIRequest(supabase, user.id, 'openai', model || 'unknown', false, latency, errorMessage);
      }
    } catch (logError) {
      console.error('[OPENAI-PROXY] Failed to log error:', logError);
    }
    
    console.error('[OPENAI-PROXY] Error:', {
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

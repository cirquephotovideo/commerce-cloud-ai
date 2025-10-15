import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// TypeScript interfaces for type safety
interface OpenRouterRequest {
  action?: 'list_models' | 'chat';
  model?: string;
  messages?: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
}

interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('[OPENROUTER-PROXY] Function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Get OpenRouter API key (user key or global fallback)
    let OPENROUTER_API_KEY = null;
    
    const { data: userConfig } = await supabase
      .from('ai_provider_configs')
      .select('api_key_encrypted')
      .eq('provider', 'openrouter')
      .eq('is_active', true)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (userConfig) {
      OPENROUTER_API_KEY = userConfig.api_key_encrypted;
    } else {
      const { data: globalConfig } = await supabase
        .from('ai_provider_configs')
        .select('api_key_encrypted')
        .eq('provider', 'openrouter')
        .eq('is_active', true)
        .is('user_id', null)
        .maybeSingle();
      
      if (globalConfig) {
        OPENROUTER_API_KEY = globalConfig.api_key_encrypted;
      } else {
        OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
        if (OPENROUTER_API_KEY) {
          console.warn('[OPENROUTER-PROXY] Using env fallback');
        }
      }
    }
    
    if (!OPENROUTER_API_KEY) {
      console.error('[OPENROUTER-PROXY] API key not configured');
      return new Response(JSON.stringify({ error: 'OpenRouter API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse and validate request body
    let requestBody: OpenRouterRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('[OPENROUTER-PROXY] Invalid JSON:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, model, messages, max_tokens, temperature } = requestBody;

    // Validate required fields based on action
    if (action === 'chat' || !action) {
      if (!model) {
        console.error('[OPENROUTER-PROXY] Missing model field');
        return new Response(JSON.stringify({ 
          error: 'Missing required field: model' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        console.error('[OPENROUTER-PROXY] Invalid messages field:', { messages });
        return new Response(JSON.stringify({ 
          error: 'Missing or invalid messages array. Must be a non-empty array of message objects.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    console.log('[OPENROUTER-PROXY] Validated request:', { 
      action: action || 'chat', 
      model, 
      messageCount: messages?.length,
      hasMaxTokens: !!max_tokens,
      hasTemperature: temperature !== undefined,
      user_id: user.id,
      timestamp: new Date().toISOString()
    });

    // Fetch available models
    if (action === 'list_models') {
      console.log('[OPENROUTER-PROXY] Fetching models');
      
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Chat completion
    console.log('[OPENROUTER-PROXY] Chat request:', { model, messageCount: messages?.length });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://lovable.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        ...(max_tokens && { max_tokens }),
        ...(temperature !== undefined && { temperature }),
        stream: false // Explicitly disable streaming
      }),
    });

    if (!response.ok) {
      let errorDetails = 'Unknown error';
      try {
        const errorJson: OpenRouterError = await response.json();
        errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        errorDetails = await response.text();
      }
      
      console.error('[OPENROUTER-PROXY] OpenRouter API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        model,
        messageCount: messages?.length
      });
      
      return new Response(JSON.stringify({ 
        error: `OpenRouter API error (${response.status}): ${errorDetails}`,
        status: response.status,
        model
      }), {
        status: response.status >= 500 ? 502 : response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const latency = Date.now() - startTime;
    console.log('[OPENROUTER-PROXY] Success', {
      latency_ms: latency,
      usage: data.usage,
      model: data.model
    });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error('[OPENROUTER-PROXY] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
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

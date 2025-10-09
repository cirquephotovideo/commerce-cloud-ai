import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { action, model, messages } = await req.json();
    console.log('[OPENROUTER-PROXY] Request:', { 
      action, 
      model, 
      messageCount: messages?.length,
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
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OPENROUTER-PROXY] Error:', response.status, error);
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
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

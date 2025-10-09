import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('[CLAUDE-PROXY] Function started');
    
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      console.error('[CLAUDE-PROXY] API key not configured');
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const { model = 'claude-sonnet-4-20250514', messages, max_tokens = 4096 } = await req.json();

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
    console.log('[CLAUDE-PROXY] Success', {
      latency_ms: latency,
      usage: data.usage
    });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error('[CLAUDE-PROXY] Error:', {
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

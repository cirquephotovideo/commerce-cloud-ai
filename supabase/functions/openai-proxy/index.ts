import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { model = 'gpt-5-mini', messages, max_completion_tokens } = await req.json();

    console.log('[OPENAI-PROXY] Request:', { model, messageCount: messages?.length });

    // Newer models (GPT-5+) use max_completion_tokens and don't support temperature
    const isNewerModel = model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4');
    
    const requestBody: any = {
      model,
      messages,
    };

    if (isNewerModel) {
      if (max_completion_tokens) {
        requestBody.max_completion_tokens = max_completion_tokens;
      }
    } else {
      // Legacy models support max_tokens and temperature
      if (max_completion_tokens) {
        requestBody.max_tokens = max_completion_tokens;
      }
      requestBody.temperature = 0.7;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OPENAI-PROXY] Error:', response.status, error);
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('[OPENAI-PROXY] Success');

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[OPENAI-PROXY] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

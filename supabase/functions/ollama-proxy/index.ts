import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    if (!user) {
      console.error('No user found in token');
      throw new Error('Not authenticated - no user found');
    }
    
    console.log('User authenticated:', user.id);

    const { action, ollama_url, api_key, model, messages } = await req.json();

    // Get user's Ollama configuration
    const { data: configData, error: configError } = await supabaseClient
      .from('ollama_configurations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (configError && configError.code !== 'PGRST116') {
      console.error('Config fetch error:', configError);
    }
    
    const config = configData;

    const targetUrl = ollama_url || config?.ollama_url;
    const targetApiKey = api_key || config?.api_key_encrypted;

    if (!targetUrl) {
      throw new Error('Ollama URL not configured');
    }

    if (action === 'test') {
      // Test connection and list models
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (targetApiKey) {
        headers['Authorization'] = `Bearer ${targetApiKey}`;
      }

      const response = await fetch(`${targetUrl}/api/tags`, {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to connect to Ollama');
      }

      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];

      return new Response(
        JSON.stringify({ success: true, models }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Proxy AI request to Ollama
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (targetApiKey) {
      headers['Authorization'] = `Bearer ${targetApiKey}`;
    }

    const ollamaResponse = await fetch(`${targetUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'llama2',
        messages: messages,
        stream: false,
      }),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama request failed: ${ollamaResponse.statusText}`);
    }

    const result = await ollamaResponse.json();

    return new Response(
      JSON.stringify({ success: true, response: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ollama-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
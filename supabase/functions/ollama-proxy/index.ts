import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUD_MODELS = [
  'deepseek-v3.1:671b-cloud',
  'gpt-oss:20b-cloud',
  'gpt-oss:120b-cloud',
  'kimi-k2:1t-cloud',
  'qwen3-coder:480b-cloud',
  'glm-4.6:cloud'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    const user = userData?.user;
    if (!user) {
      console.error('No user found in token');
      throw new Error('Not authenticated - no user found');
    }
    
    console.log('User authenticated:', user.id);

    const { action, ollama_url, api_key, model, messages, web_search } = await req.json();

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
    const isCloudMode = targetUrl === 'https://ollama.com';
    
    // For cloud mode, use OLLAMA_API_KEY from secrets
    const targetApiKey = isCloudMode 
      ? Deno.env.get('OLLAMA_API_KEY')
      : (api_key || config?.api_key_encrypted);

    if (!targetUrl) {
      throw new Error('Ollama URL not configured');
    }

    console.log(`[OLLAMA-PROXY] Mode: ${isCloudMode ? 'Cloud' : 'Local'}, URL: ${targetUrl}`);

    if (action === 'test') {
      // Test connection and list models
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (targetApiKey) {
        headers['Authorization'] = `Bearer ${targetApiKey}`;
      }

      const testEndpoint = isCloudMode ? `${targetUrl}/api/tags` : `${targetUrl}/api/tags`;
      const response = await fetch(testEndpoint, {
        headers,
      });

      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        throw new Error(`Failed to connect to Ollama (status ${response.status}: ${statusText})`);
      }

      const data = await response.json();
      let models = data.models?.map((m: any) => m.name) || [];
      
      // For cloud mode, also include predefined cloud models
      if (isCloudMode) {
        models = [...new Set([...CLOUD_MODELS, ...models])];
      }

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

    const endpoint = isCloudMode 
      ? `${targetUrl}/api/chat`
      : `${targetUrl}/api/chat`;

    const requestBody = isCloudMode
      ? {
          model: model || 'gpt-oss:120b-cloud',
          messages: messages,
          stream: false,
          web_search: web_search || false
        }
      : {
          model: model || 'llama2',
          messages: messages,
          stream: false
        };

    console.log(`[OLLAMA-PROXY] Calling ${endpoint} with model: ${requestBody.model}`);

    const ollamaResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!ollamaResponse.ok) {
      const statusText = ollamaResponse.statusText || 'Unknown error';
      const errorBody = await ollamaResponse.text();
      console.error(`[OLLAMA-PROXY] ❌ Request failed:`, {
        status: ollamaResponse.status,
        statusText,
        endpoint,
        model: requestBody.model,
        errorBody
      });
      throw new Error(
        `Ollama request failed (status ${ollamaResponse.status}: ${statusText})\n` +
        `Endpoint: ${endpoint}\n` +
        `Model: ${requestBody.model}\n` +
        `Error: ${errorBody.substring(0, 500)}`
      );
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
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authentifier l'utilisateur
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Récupérer la configuration Ollama de l'utilisateur
    const { data: ollamaConfig, error: configError } = await supabase
      .from('ollama_configurations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error('Error fetching Ollama config:', configError);
      
      // Handle PGRST002 (schema cache) error specifically
      if (configError.code === 'PGRST002') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Database schema is updating. Please try again in a moment.',
            code: 'PGRST002'
          }),
          { 
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      throw configError;
    }

    if (!ollamaConfig) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No Ollama configuration found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tester la connexion Ollama
    const isCloudMode = ollamaConfig.ollama_url === 'https://ollama.com';
    let status: 'online' | 'offline' = 'offline';
    let responseTime = 0;
    let availableModels: string[] = [];
    let errorDetails: any = null;

    console.log('[OLLAMA-SYNC] Testing connection:', { 
      url: ollamaConfig.ollama_url, 
      isCloudMode 
    });

    try {
      const startTime = Date.now();
      
      const testResponse = await fetch(`${ollamaConfig.ollama_url}/api/tags`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ollamaConfig.api_key_encrypted}`,
        },
        signal: AbortSignal.timeout(5000), // Timeout de 5s
      });

      responseTime = Date.now() - startTime;

      console.log('[OLLAMA-SYNC] Test response:', {
        status: testResponse.status,
        ok: testResponse.ok,
        responseTime
      });

      if (testResponse.ok) {
        const data = await testResponse.json();
        availableModels = data.models?.map((m: any) => m.name) || [];
        status = 'online';
        console.log('[OLLAMA-SYNC] Available models:', availableModels);
      } else {
        errorDetails = {
          status: testResponse.status,
          message: testResponse.statusText
        };
        console.error('[OLLAMA-SYNC] Connection failed:', errorDetails);
      }
    } catch (error) {
      console.error('[OLLAMA-SYNC] Connection test error:', error);
      errorDetails = {
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    }

    // Mettre à jour ai_provider_health avec provider='ollama' uniquement
    // Stocker le mode (cloud/local) dans error_details
    const mode = isCloudMode ? 'cloud' : 'local';
    const enrichedErrorDetails = errorDetails ? { ...errorDetails, mode } : { mode };
    
    console.log('[OLLAMA-SYNC] Updating ai_provider_health:', {
      provider: 'ollama',
      mode,
      status,
      availableModels
    });
    
    const { error: healthError } = await supabase
      .from('ai_provider_health')
      .upsert({
        provider: 'ollama',
        status,
        response_time_ms: responseTime,
        available_models: availableModels,
        error_details: enrichedErrorDetails,
        last_check: new Date().toISOString(),
      }, { onConflict: 'provider' });

    if (healthError) {
      console.error('[OLLAMA-SYNC] Error updating health:', healthError);
    } else {
      console.log('[OLLAMA-SYNC] Health status updated successfully for provider=ollama');
    }

    // Mettre à jour ai_provider_configs avec provider='ollama'
    if (status === 'online') {
      const { error: configUpdateError } = await supabase
        .from('ai_provider_configs')
        .upsert({
          user_id: user.id,
          provider: 'ollama',
          api_key_encrypted: ollamaConfig.api_key_encrypted,
          api_url: ollamaConfig.ollama_url,
          default_model: availableModels[0] || null,
          is_active: ollamaConfig.is_active,
          priority: 3,
        }, { onConflict: 'user_id,provider' });

      if (configUpdateError) {
        console.error('[OLLAMA-SYNC] Error updating config:', configUpdateError);
      } else {
        console.log('[OLLAMA-SYNC] Config updated successfully for provider=ollama');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        provider: 'ollama',
        mode: isCloudMode ? 'cloud' : 'local',
        status,
        response_time_ms: responseTime,
        available_models: availableModels
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

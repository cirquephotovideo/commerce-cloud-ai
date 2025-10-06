import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const logToDatabase = async (level: string, event_type: string, message: string, metadata: any = {}) => {
      try {
        await supabase.from('amazon_edge_logs').insert({
          function_name: 'amazon-token-manager',
          level,
          event_type,
          event_message: message,
          metadata
        });
      } catch (error) {
        console.error('[LOG-ERROR]', error);
      }
    };

    console.log('[AMAZON-TOKEN] Checking for valid access token...');
    await logToDatabase('info', 'Start', 'Début de la génération de token Amazon');

    // 1. Essayer d'abord les secrets d'environnement
    let clientId = Deno.env.get('AMAZON_CLIENT_ID');
    let clientSecret = Deno.env.get('AMAZON_CLIENT_SECRET');
    let refreshToken = Deno.env.get('AMAZON_REFRESH_TOKEN');
    let marketplaceId = 'A13V1IB3VIYZZH'; // Défaut France
    let credentialsId: string | null = null;

    // 2. Fallback vers la base de données si les secrets ne sont pas configurés
    if (!clientId || !clientSecret || !refreshToken) {
      console.log('[AMAZON-TOKEN] Environment secrets not found, fetching from database...');
      await logToDatabase('info', 'Config', 'Chargement des credentials depuis la base de données');
      const { data: credentials, error: credError } = await supabase
        .from('amazon_credentials')
        .select('*')
        .eq('is_active', true)
        .single();

      if (credError || !credentials) {
        throw new Error('Amazon credentials not configured in environment or database');
      }

      clientId = credentials.client_id;
      clientSecret = credentials.client_secret_encrypted;
      refreshToken = credentials.refresh_token_encrypted;
      marketplaceId = credentials.marketplace_id;
      credentialsId = credentials.id;
      
      console.log('[AMAZON-TOKEN] Credentials loaded from database:', credentials.id);
    } else {
      console.log('[AMAZON-TOKEN] Using credentials from environment secrets');
    }

    // 3. Vérifier si un token valide existe (uniquement si on a un credentialsId de la DB)
    let existingToken = null;
    if (credentialsId) {
      const { data } = await supabase
        .from('amazon_access_tokens')
        .select('*')
        .eq('credential_id', credentialsId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existingToken = data;
    }

    if (existingToken) {
      console.log('[AMAZON-TOKEN] Valid token found, expires at:', existingToken.expires_at);
      await logToDatabase('info', 'Success', `Token valide trouvé, expire à ${existingToken.expires_at}`);
      return new Response(
        JSON.stringify({ 
          access_token: existingToken.access_token,
          expires_at: existingToken.expires_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AMAZON-TOKEN] No valid token, generating new one...');
    await logToDatabase('info', 'Generate', 'Génération d\'un nouveau token Amazon');

    // 4. Vérifier que toutes les credentials sont présentes
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing required Amazon credentials');
    }

    // 5. Générer un nouveau token
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[AMAZON-TOKEN] OAuth error:', errorText);
      await logToDatabase('error', 'OAuthError', `Erreur OAuth Amazon: ${errorText}`);
      throw new Error(`Amazon OAuth failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[AMAZON-TOKEN] New token generated successfully');
    await logToDatabase('info', 'Success', 'Nouveau token généré avec succès');

    // 6. Stocker le nouveau token (uniquement si on a un credentialsId de la DB)
    const expiresAt = new Date(Date.now() + 3600 * 1000); // +1 heure
    let savedToken = null;
    
    if (credentialsId) {
      const { data, error: saveError } = await supabase
        .from('amazon_access_tokens')
        .insert({
          access_token: tokenData.access_token,
          expires_at: expiresAt.toISOString(),
          credential_id: credentialsId,
        })
        .select()
        .single();

      if (saveError) {
        console.error('[AMAZON-TOKEN] Save error:', saveError);
      } else {
        savedToken = data;
        console.log('[AMAZON-TOKEN] Token saved, expires at:', expiresAt);
      }
    } else {
      console.log('[AMAZON-TOKEN] Token generated from env secrets, not stored in DB');
    }

    return new Response(
      JSON.stringify({ 
        access_token: tokenData.access_token,
        expires_at: expiresAt.toISOString(),
        generated: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AMAZON-TOKEN] Error:', error);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('amazon_edge_logs').insert({
      function_name: 'amazon-token-manager',
      level: 'error',
      event_type: 'Error',
      event_message: `Erreur: ${error.message || 'Unknown error'}`,
      metadata: { stack: error.stack }
    });
    
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

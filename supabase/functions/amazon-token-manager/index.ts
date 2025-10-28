import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const createErrorResponse = (
  code: string, 
  message: string, 
  httpStatus: number = 500, 
  details?: any
) => {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code,
      http_status: httpStatus,
      details,
      timestamp: new Date().toISOString()
    }),
    { 
      status: 200, // ✅ Toujours 200 pour éviter les erreurs non-2xx
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
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
        console.log('[AMAZON-TOKEN] No credentials found in database');
        return createErrorResponse(
          'CREDENTIALS_MISSING',
          'Credentials Amazon non configurés. Veuillez les ajouter dans Admin.',
          400
        );
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
      console.log('[AMAZON-TOKEN] Incomplete credentials');
      return createErrorResponse(
        'CREDENTIALS_INCOMPLETE',
        'Credentials Amazon incomplètes (Client ID, Secret ou Refresh Token manquant).',
        400
      );
    }

    // 5. Générer un nouveau token
    const requestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    await logToDatabase('info', 'TokenRequest', 'Envoi de la requête OAuth à Amazon', {
      url: 'https://api.amazon.com/auth/o2/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: {
        grant_type: 'refresh_token',
        client_id: clientId,
        // Ne pas logger les secrets complets
        refresh_token: refreshToken ? `${refreshToken.substring(0, 10)}...` : undefined,
        client_secret: clientSecret ? '***MASKED***' : undefined
      }
    });

    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: requestBody,
    });

    const responseHeaders: Record<string, string> = {};
    tokenResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[AMAZON-TOKEN] OAuth error:', errorText);
      
      let parsedError: any = {};
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = { error: 'parse_error', error_description: errorText };
      }
      
      await logToDatabase('error', 'OAuthError', `Erreur OAuth Amazon: ${errorText}`, {
        response: { 
          status: tokenResponse.status, 
          statusText: tokenResponse.statusText, 
          headers: responseHeaders,
          body: parsedError 
        }
      });
      
      // Mapper les codes d'erreur Amazon
      let errorCode = 'OAUTH_ERROR';
      let userMessage = parsedError.error_description || 'Échec authentification Amazon';
      
      if (parsedError.error === 'invalid_client') {
        errorCode = 'INVALID_CLIENT';
        userMessage = 'Client ID ou Client Secret invalide';
      } else if (parsedError.error === 'invalid_grant') {
        errorCode = 'INVALID_GRANT';
        userMessage = 'Refresh Token expiré ou révoqué';
      } else if (parsedError.error === 'unauthorized_client') {
        errorCode = 'UNAUTHORIZED_CLIENT';
        userMessage = 'Application non autorisée pour cette opération';
      }
      
      return createErrorResponse(errorCode, userMessage, tokenResponse.status, { 
        amazonError: parsedError 
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('[AMAZON-TOKEN] New token generated successfully');
    await logToDatabase('info', 'Success', 'Nouveau token généré avec succès', {
      response: {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        headers: responseHeaders,
        body: {
          access_token: tokenData.access_token ? `${tokenData.access_token.substring(0, 20)}...` : undefined,
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in
        }
      }
    });

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
    
    // Déterminer le code d'erreur
    let errorCode = 'UNKNOWN_ERROR';
    let httpStatus = 500;
    
    if (error.message?.includes('not configured')) {
      errorCode = 'CREDENTIALS_MISSING';
      httpStatus = 400;
    } else if (error.message?.includes('Missing required')) {
      errorCode = 'CREDENTIALS_INCOMPLETE';
      httpStatus = 400;
    }
    
    return createErrorResponse(
      errorCode,
      error.message || 'Une erreur inconnue est survenue',
      httpStatus
    );
  }
});

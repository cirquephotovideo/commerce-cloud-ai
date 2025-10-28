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

    // 1. Vérifier les secrets d'environnement
    const clientId = Deno.env.get('AMAZON_CLIENT_ID');
    const clientSecret = Deno.env.get('AMAZON_CLIENT_SECRET');
    const refreshToken = Deno.env.get('AMAZON_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      return new Response(JSON.stringify({
        success: false,
        status: 'missing',
        message: 'Credentials manquantes',
        details: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          hasRefreshToken: !!refreshToken
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Tester la génération de token (sans le sauvegarder)
    const tokenUrl = 'https://api.amazon.com/auth/o2/token';
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      let parsedError: any = {};
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = { error: 'parse_error' };
      }

      let statusType = 'invalid';
      if (parsedError.error === 'unauthorized_client') {
        statusType = 'unauthorized';
      } else if (parsedError.error === 'invalid_grant') {
        statusType = 'expired';
      }

      return new Response(JSON.stringify({
        success: false,
        status: statusType,
        message: parsedError.error_description || 'Credentials invalides',
        errorCode: parsedError.error,
        httpStatus: tokenResponse.status
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Succès - credentials valides
    const tokenData = await tokenResponse.json();
    const expiresIn = tokenData.expires_in || 3600;

    return new Response(JSON.stringify({
      success: true,
      status: 'valid',
      message: 'Credentials Amazon valides',
      expiresIn,
      validatedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[VALIDATE-AMAZON] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      status: 'error',
      message: error.message || 'Erreur de validation'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

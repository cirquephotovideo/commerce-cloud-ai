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
    const { scenario } = await req.json();

    // Simuler différents scénarios d'erreur
    const scenarios: Record<string, any> = {
      'missing': {
        success: false,
        code: 'CREDENTIALS_MISSING',
        error: 'Credentials Amazon non configurées',
        http_status: 400
      },
      'incomplete': {
        success: false,
        code: 'CREDENTIALS_INCOMPLETE',
        error: 'Credentials Amazon incomplètes (Client ID, Secret ou Refresh Token manquant)',
        http_status: 400
      },
      'invalid_client': {
        success: false,
        code: 'INVALID_CLIENT',
        error: 'Client ID ou Client Secret invalide',
        http_status: 401,
        details: { amazonError: { error: 'invalid_client' } }
      },
      'invalid_grant': {
        success: false,
        code: 'INVALID_GRANT',
        error: 'Refresh Token expiré ou révoqué',
        http_status: 401,
        details: { amazonError: { error: 'invalid_grant' } }
      },
      'unauthorized_client': {
        success: false,
        code: 'UNAUTHORIZED_CLIENT',
        error: 'Application non autorisée pour cette opération',
        http_status: 403,
        details: { amazonError: { error: 'unauthorized_client' } }
      },
      'success': {
        success: true,
        access_token: 'Atza|IQEBLjAsAhRmHjNgHpi0U-Dme37rR6CuUpSREXAMPLE',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        generated: true
      }
    };

    const response = scenarios[scenario] || scenarios['missing'];

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

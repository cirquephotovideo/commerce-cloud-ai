import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { credentials } = await req.json();
    
    // Vérifier que tous les credentials requis sont présents
    const requiredFields = [
      'SP_API_CLIENT_ID',
      'SP_API_CLIENT_SECRET', 
      'SP_API_REFRESH_TOKEN',
      'SP_API_AWS_ACCESS_KEY',
      'SP_API_AWS_SECRET_KEY',
      'SP_API_ROLE_ARN',
      'SP_API_MARKETPLACE_ID',
      'SP_API_REGION'
    ];
    
    const missingFields = requiredFields.filter(field => !credentials[field]);
    if (missingFields.length > 0) {
      throw new Error(`Credentials manquants: ${missingFields.join(', ')}`);
    }

    // Obtenir un access token via amazon-token-manager
    const tokenResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/amazon-token-manager`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          clientId: credentials.SP_API_CLIENT_ID,
          clientSecret: credentials.SP_API_CLIENT_SECRET,
          refreshToken: credentials.SP_API_REFRESH_TOKEN
        })
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Échec de l'authentification Amazon: ${tokenResponse.status} - ${errorText}`);
    }

    const { accessToken } = await tokenResponse.json();
    
    // Faire une requête test simple à l'API Amazon
    const region = credentials.SP_API_REGION || 'eu-west-1';
    const marketplaceId = credentials.SP_API_MARKETPLACE_ID || 'A13V1IB3VIYZZH';
    const testUrl = `https://sellingpartnerapi-${region}.amazon.com/catalog/2022-04-01/items?keywords=test&marketplaceIds=${marketplaceId}`;
    
    const testResponse = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      throw new Error(`Test API Amazon échoué: ${testResponse.status} - ${errorText}`);
    }

    // Succès !
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Connexion Amazon réussie',
        serverVersion: '1.0.0'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erreur test Amazon MCP:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthStartRequest {
  appId: string;
  region: 'EU' | 'NA' | 'FE';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appId, region = 'EU' }: OAuthStartRequest = await req.json();

    if (!appId) {
      return new Response(
        JSON.stringify({ error: 'App ID requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Endpoints Amazon par région
    const regionEndpoints = {
      EU: 'https://sellercentral-europe.amazon.com',
      NA: 'https://sellercentral.amazon.com',
      FE: 'https://sellercentral.amazon.co.jp'
    };

    const baseUrl = regionEndpoints[region];
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/amazon-oauth-callback`;
    
    // Construire l'URL de consentement OAuth
    const authUrl = new URL(`${baseUrl}/apps/authorize/consent`);
    authUrl.searchParams.set('application_id', appId);
    authUrl.searchParams.set('state', region); // Stocker la région dans le state
    authUrl.searchParams.set('version', 'beta');

    console.log('OAuth Start:', {
      appId,
      region,
      redirectUri,
      authUrl: authUrl.toString()
    });

    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        redirectUri 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

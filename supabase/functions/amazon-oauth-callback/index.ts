import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('spapi_oauth_code');
    const state = url.searchParams.get('state'); // région
    const sellingPartnerId = url.searchParams.get('selling_partner_id');

    console.log('OAuth Callback received:', {
      hasCode: !!code,
      state,
      sellingPartnerId
    });

    if (!code) {
      // Rediriger vers l'admin avec une erreur
      const errorUrl = new URL('/admin', Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '') || '');
      errorUrl.searchParams.set('amazon_error', 'Code OAuth manquant');
      return Response.redirect(errorUrl.toString(), 302);
    }

    // Récupérer les credentials LWA depuis les secrets
    const clientId = Deno.env.get('AMAZON_CLIENT_ID');
    const clientSecret = Deno.env.get('AMAZON_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('AMAZON_CLIENT_ID ou AMAZON_CLIENT_SECRET manquant dans les secrets');
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/amazon-oauth-callback`;

    // Échanger le code contre un refresh_token
    console.log('Exchanging code for refresh_token...');
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      const errorUrl = new URL('/admin', Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '') || '');
      errorUrl.searchParams.set('amazon_error', `Échec de l'échange: ${tokenData.error_description || tokenData.error}`);
      return Response.redirect(errorUrl.toString(), 302);
    }

    console.log('Token exchange successful');

    // Initialiser le client Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Stocker le refresh_token dans la table amazon_credentials
    const { error: dbError } = await supabase
      .from('amazon_credentials')
      .insert({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refresh_token,
        marketplace_id: state || 'EU', // Utiliser la région depuis le state
        is_active: true,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      const errorUrl = new URL('/admin', Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '') || '');
      errorUrl.searchParams.set('amazon_error', `Erreur DB: ${dbError.message}`);
      return Response.redirect(errorUrl.toString(), 302);
    }

    console.log('Refresh token stored successfully');

    // Rediriger vers l'admin avec succès
    const successUrl = new URL('/admin', Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '') || '');
    successUrl.searchParams.set('amazon_success', 'Authorization réussie! Credentials enregistrés.');
    return Response.redirect(successUrl.toString(), 302);

  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorUrl = new URL('/admin', Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '') || '');
    errorUrl.searchParams.set('amazon_error', error instanceof Error ? error.message : String(error));
    return Response.redirect(errorUrl.toString(), 302);
  }
});

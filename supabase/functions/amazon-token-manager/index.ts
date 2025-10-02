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

    console.log('[AMAZON-TOKEN] Checking for valid access token...');

    // 1. Récupérer les credentials actifs
    const { data: credentials, error: credError } = await supabase
      .from('amazon_credentials')
      .select('*')
      .eq('is_active', true)
      .single();

    if (credError || !credentials) {
      throw new Error('Amazon credentials not configured');
    }

    console.log('[AMAZON-TOKEN] Credentials found:', credentials.id);

    // 2. Vérifier si un token valide existe
    const { data: existingToken } = await supabase
      .from('amazon_access_tokens')
      .select('*')
      .eq('credential_id', credentials.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingToken) {
      console.log('[AMAZON-TOKEN] Valid token found, expires at:', existingToken.expires_at);
      return new Response(
        JSON.stringify({ 
          access_token: existingToken.access_token,
          expires_at: existingToken.expires_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AMAZON-TOKEN] No valid token, generating new one...');

    // 3. Générer un nouveau token
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token_encrypted,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret_encrypted,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[AMAZON-TOKEN] OAuth error:', errorText);
      throw new Error(`Amazon OAuth failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[AMAZON-TOKEN] New token generated successfully');

    // 4. Stocker le nouveau token
    const expiresAt = new Date(Date.now() + 3600 * 1000); // +1 heure
    const { data: savedToken, error: saveError } = await supabase
      .from('amazon_access_tokens')
      .insert({
        access_token: tokenData.access_token,
        expires_at: expiresAt.toISOString(),
        credential_id: credentials.id,
      })
      .select()
      .single();

    if (saveError) {
      console.error('[AMAZON-TOKEN] Save error:', saveError);
      throw saveError;
    }

    console.log('[AMAZON-TOKEN] Token saved, expires at:', expiresAt);

    return new Response(
      JSON.stringify({ 
        access_token: savedToken.access_token,
        expires_at: savedToken.expires_at,
        generated: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AMAZON-TOKEN] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

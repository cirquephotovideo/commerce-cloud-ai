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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current credentials
    const { data: credentials, error: credError } = await supabase
      .from('amazon_credentials')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (credError) throw credError;
    if (!credentials) {
      return new Response(
        JSON.stringify({ error: 'No active Amazon credentials found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ROTATE-AMAZON] Starting credential rotation for Client ID:', credentials.client_id);

    // Call Amazon Application Management API to rotate credentials
    // https://developer-docs.amazon.com/sp-api/docs/application-management-api-v2023-11-30-reference
    const rotationEndpoint = 'https://api.amazon.com/auth/o2/token';
    
    // Step 1: Get access token for Application Management API
    const tokenResponse = await fetch(rotationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token_encrypted,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret_encrypted,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[ROTATE-AMAZON] Failed to get access token:', errorText);
      throw new Error(`Failed to authenticate: ${errorText}`);
    }

    const { access_token } = await tokenResponse.json();
    console.log('[ROTATE-AMAZON] Access token obtained');

    // Step 2: Call rotation endpoint
    // Note: The actual Application Management API endpoint for rotation
    const managementApiUrl = `https://sellingpartnerapi-eu.amazon.com/applications/2023-11-30/clientSecret`;
    
    const rotationResponse = await fetch(managementApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'x-amz-access-token': access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: credentials.client_id,
      }),
    });

    if (!rotationResponse.ok) {
      const errorText = await rotationResponse.text();
      console.error('[ROTATE-AMAZON] Rotation failed:', errorText);
      
      // If we get 404 or method not supported, provide manual instructions
      if (rotationResponse.status === 404 || rotationResponse.status === 405) {
        return new Response(
          JSON.stringify({
            error: 'manual_rotation_required',
            message: 'La rotation automatique n\'est pas disponible. Veuillez effectuer la rotation manuellement via Seller Central.',
            instructions: {
              url: 'https://sellercentral.amazon.fr/sellingpartner/developerconsole',
              steps: [
                'Connectez-vous à Seller Central',
                'Accédez à la Developer Console',
                'Recherchez l\'application avec l\'alerte d\'expiration',
                'Cliquez sur "Rotation secrète"',
                'Mettez à jour les nouvelles informations d\'identification ici'
              ]
            },
            current_expiry: credentials.secret_expires_at,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Rotation API error: ${errorText}`);
    }

    const rotationData = await rotationResponse.json();
    console.log('[ROTATE-AMAZON] New credentials received');

    // Step 3: Update database with new credentials
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 180); // 180 days from now

    const { error: updateError } = await supabase
      .from('amazon_credentials')
      .update({
        client_secret_encrypted: rotationData.clientSecret,
        secret_expires_at: expiresAt.toISOString(),
        last_rotation_at: new Date().toISOString(),
        rotation_warning_sent: false,
      })
      .eq('id', credentials.id);

    if (updateError) throw updateError;

    console.log('[ROTATE-AMAZON] Credentials updated successfully');

    // Step 4: Invalidate existing access tokens
    await supabase
      .from('amazon_access_tokens')
      .delete()
      .eq('credential_id', credentials.id);

    console.log('[ROTATE-AMAZON] Old access tokens invalidated');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Credentials rotated successfully',
        expires_at: expiresAt.toISOString(),
        next_rotation_date: expiresAt.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ROTATE-AMAZON] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

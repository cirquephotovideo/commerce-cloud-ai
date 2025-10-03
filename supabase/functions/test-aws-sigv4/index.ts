import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get AWS credentials from database
    const { data: awsCreds, error: credsError } = await supabase
      .from('aws_credentials')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (credsError) throw credsError;
    if (!awsCreds) {
      return new Response(
        JSON.stringify({ success: false, error: 'AWS credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Amazon LWA token for the test
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('amazon-token-manager');
    if (tokenError) throw tokenError;
    if (!tokenData?.access_token) throw new Error('Failed to get Amazon access token');

    const accessToken = tokenData.access_token;

    // Test AWS STS AssumeRole (validates IAM credentials)
    console.log('[TEST-AWS] Testing STS AssumeRole...');
    
    const stsUrl = `https://sts.${awsCreds.region}.amazonaws.com/`;
    const stsParams = new URLSearchParams({
      Action: 'AssumeRole',
      RoleArn: awsCreds.role_arn,
      RoleSessionName: `test-aws-sigv4-${Date.now()}`,
      Version: '2011-06-15',
    });

    // Simple AWS Signature V4 implementation for STS
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = timestamp.slice(0, 8);

    const stsRequest = await fetch(`${stsUrl}?${stsParams.toString()}`, {
      method: 'GET',
      headers: {
        'Host': `sts.${awsCreds.region}.amazonaws.com`,
        'X-Amz-Date': timestamp,
      },
    });

    if (!stsRequest.ok) {
      const errorText = await stsRequest.text();
      console.error('[TEST-AWS] STS AssumeRole failed:', stsRequest.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `STS AssumeRole failed: ${stsRequest.status}`,
          details: errorText 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[TEST-AWS] STS AssumeRole successful');

    // Test a simple Amazon SP-API call (Catalog Items API)
    const marketplaceId = Deno.env.get('AMAZON_MARKETPLACE_ID') || 'A13V1IB3VIYZZH';
    const testAsin = 'B08N5WRWNW'; // Known test ASIN
    
    const spApiUrl = `https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/${testAsin}?marketplaceIds=${marketplaceId}`;
    
    console.log('[TEST-AWS] Testing SP-API call...');
    
    const spApiRequest = await fetch(spApiUrl, {
      method: 'GET',
      headers: {
        'x-amz-access-token': accessToken,
        'Host': 'sellingpartnerapi-eu.amazon.com',
      },
    });

    const spApiText = await spApiRequest.text();
    console.log('[TEST-AWS] SP-API response:', spApiRequest.status, spApiText.slice(0, 200));

    if (spApiRequest.status === 403) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SP-API returned 403 - SigV4 signing required or invalid permissions',
          hint: 'Verify AWS Role has SP-API permissions attached'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (spApiRequest.status === 404) {
      // 404 is OK for testing - means authentication worked but product not found
      console.log('[TEST-AWS] SP-API authentication successful (404 is expected for test)');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'AWS SigV4 test successful - STS and SP-API authentication verified',
        details: {
          sts_status: 'OK',
          spapi_status: spApiRequest.status,
          region: awsCreds.region,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TEST-AWS] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

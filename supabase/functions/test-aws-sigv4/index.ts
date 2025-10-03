import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { STSClient, AssumeRoleCommand } from "https://esm.sh/@aws-sdk/client-sts@3.645.0";
import { SignatureV4 } from "https://esm.sh/@smithy/signature-v4@4.2.0";
import { Sha256 } from "https://esm.sh/@aws-crypto/sha256-js@5.2.0";
import { HttpRequest } from "https://esm.sh/@smithy/protocol-http@4.1.7";

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

    // Get AWS credentials from database
    const { data: awsCreds, error: credsError } = await supabase
      .from('aws_credentials')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (credsError) throw credsError;
    if (!awsCreds) {
      return new Response(
        JSON.stringify({ success: false, error: 'AWS credentials not configured in database' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const region = awsCreds.region || 'eu-west-1';
    console.log('[TEST-AWS] Testing AWS SigV4 with region:', region);

    // Test 1: AWS STS AssumeRole
    console.log('[TEST-AWS] Step 1: Testing STS AssumeRole...');
    
    const stsClient = new STSClient({
      region,
      credentials: {
        accessKeyId: awsCreds.access_key_id_encrypted,
        secretAccessKey: awsCreds.secret_access_key_encrypted,
      },
    });

    const assumeRoleCmd = new AssumeRoleCommand({
      RoleArn: awsCreds.role_arn,
      RoleSessionName: `test-sigv4-${Date.now()}`,
      DurationSeconds: 3600,
    });

    let stsResponse;
    try {
      stsResponse = await stsClient.send(assumeRoleCmd);
    } catch (stsError: any) {
      console.error('[TEST-AWS] STS AssumeRole failed:', stsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'STS AssumeRole failed',
          details: stsError.message,
          hint: 'Verify AWS Access Key ID, Secret Access Key, and Role ARN are correct'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tempCreds = stsResponse.Credentials;
    if (!tempCreds?.AccessKeyId || !tempCreds?.SecretAccessKey || !tempCreds?.SessionToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to get temporary credentials from STS'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[TEST-AWS] ✓ STS AssumeRole successful');

    // Test 2: Get Amazon LWA token
    console.log('[TEST-AWS] Step 2: Getting Amazon LWA token...');
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('amazon-token-manager');
    if (tokenError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to get Amazon access token',
          details: tokenError.message 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!tokenData?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No access token returned from amazon-token-manager' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tokenData.access_token;
    console.log('[TEST-AWS] ✓ LWA token obtained');

    // Test 3: Signed Amazon SP-API call
    console.log('[TEST-AWS] Step 3: Testing signed SP-API call...');
    
    const marketplaceId = Deno.env.get('AMAZON_MARKETPLACE_ID') || 'A13V1IB3VIYZZH';
    const testAsin = 'B08N5WRWNW'; // Test ASIN
    
    const signer = new SignatureV4({
      service: 'execute-api',
      region,
      credentials: {
        accessKeyId: tempCreds.AccessKeyId,
        secretAccessKey: tempCreds.SecretAccessKey,
        sessionToken: tempCreds.SessionToken,
      },
      sha256: Sha256,
    });

    const url = new URL(`https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/${testAsin}?marketplaceIds=${marketplaceId}`);
    const request = new HttpRequest({
      method: 'GET',
      protocol: 'https:',
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'host': url.hostname,
        'x-amz-access-token': accessToken,
        'Accept': 'application/json',
      },
    });

    const signedRequest = await signer.sign(request);
    
    const spApiResponse = await fetch(url.toString(), {
      method: signedRequest.method,
      headers: signedRequest.headers as HeadersInit,
    });

    const spApiText = await spApiResponse.text();
    console.log('[TEST-AWS] SP-API response:', spApiResponse.status, spApiText.slice(0, 200));

    if (spApiResponse.status === 403) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SP-API returned 403 - Invalid IAM permissions',
          hint: 'Verify AWS Role has "execute-api:Invoke" permission for Amazon SP-API',
          details: spApiText
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (spApiResponse.status === 404) {
      console.log('[TEST-AWS] ✓ SP-API authentication successful (404 is expected - test ASIN)');
    } else if (spApiResponse.status === 200) {
      console.log('[TEST-AWS] ✓ SP-API call fully successful');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'AWS SigV4 integration fully functional',
        details: {
          sts_assume_role: 'OK',
          lwa_token: 'OK',
          spapi_signed_request: 'OK',
          spapi_status: spApiResponse.status,
          region,
          marketplace: marketplaceId,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TEST-AWS] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

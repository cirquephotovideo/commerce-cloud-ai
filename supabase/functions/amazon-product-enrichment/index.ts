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

  // Cache pour éviter "Body already consumed"
  let requestBodyCache: any = null;
  let analysisIdRef: string | null = null;

  try {
    requestBodyCache = await req.json();
    const { analysis_id, ean, asin, product_name } = requestBodyCache;
    let productName = product_name;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const logToDatabase = async (level: string, event_type: string, message: string, metadata: any = {}) => {
      try {
        await supabase.from('amazon_edge_logs').insert({
          function_name: 'amazon-product-enrichment',
          level,
          event_type,
          event_message: message,
          metadata: { ...metadata, analysis_id, product_name: productName, ean, asin }
        });
      } catch (error) {
        console.error('[LOG-ERROR]', error);
      }
    };

    console.log('[AMAZON-ENRICH] Starting enrichment:', { analysis_id, product_name: productName, ean, asin });
    await logToDatabase('info', 'Start', `Enrichissement Amazon démarré pour ${productName || ean || asin}`);

    let userId: string;
    let productEan: string | undefined = ean;
    let productAsin: string | undefined = asin;
    let analysisId = analysis_id;
    analysisIdRef = analysis_id; // Cache l'ID pour le catch
    let currentAnalysis: any = null;

    // 1. Si analysis_id fourni, récupérer les infos
    if (analysis_id) {
      const { data: analysis, error: analysisError } = await supabase
        .from('product_analyses')
        .select('*, user_id')
        .eq('id', analysis_id)
        .single();

      if (analysisError || !analysis) {
        throw new Error('Product analysis not found');
      }

      currentAnalysis = analysis;
      userId = analysis.user_id;
      
      // Récupérer EAN/ASIN depuis l'analyse si pas fourni
      if (!productEan && !productAsin) {
        productEan = analysis.analysis_result?.barcode || 
                     analysis.analysis_result?.ean || 
                     analysis.analysis_result?.gtin;
        
        // Vérifier si product_url contient un EAN valide (13 chiffres)
        if (!productEan && analysis.product_url && /^\d{13}$/.test(analysis.product_url)) {
          console.log('[AMAZON-ENRICH] EAN found in product_url:', analysis.product_url);
          productEan = analysis.product_url;
        }
      }

      // Si pas d'EAN/ASIN, récupérer le nom du produit
      if (!productEan && !productAsin && !productName) {
        productName = analysis.analysis_result?.product_name;
      }

      console.log('[AMAZON-ENRICH] Identifiers extracted:', { 
        productEan, 
        productAsin, 
        product_name: productName 
      });

      // Mettre à jour le statut à "pending"
      await supabase
        .from('product_analyses')
        .update({ 
          amazon_enrichment_status: 'pending',
          amazon_last_attempt: new Date().toISOString()
        })
        .eq('id', analysis_id);
    } else {
      // Créer une nouvelle analyse si nécessaire
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      userId = user.id;

      // Créer l'analyse basique
      const { data: newAnalysis, error: createError } = await supabase
        .from('product_analyses')
        .insert({
          user_id: userId,
          product_url: productName || ean || asin || '',
          analysis_result: {
            product_name: productName,
            ean: ean,
            asin: asin
          },
          amazon_enrichment_status: 'pending',
          amazon_last_attempt: new Date().toISOString()
        })
        .select()
        .single();

      if (createError || !newAnalysis) {
        throw new Error('Failed to create analysis');
      }

      analysisId = newAnalysis.id;
      analysisIdRef = newAnalysis.id; // Mettre à jour le cache
    }

    // Vérifier qu'on a au moins un identifiant
    const hasIdentifier = productEan || productAsin || productName;
    if (!hasIdentifier) {
      console.error('[AMAZON-ENRICH] Missing identifiers:', {
        analysis_id: analysisId,
        productEan,
        productAsin,
        product_name: productName,
        product_url: currentAnalysis?.product_url,
        analysis_result_keys: Object.keys(currentAnalysis?.analysis_result || {})
      });
      
      await supabase
        .from('product_analyses')
        .update({ 
          amazon_enrichment_status: 'error',
          amazon_last_attempt: new Date().toISOString()
        })
        .eq('id', analysisId);
      
      return new Response(
        JSON.stringify({ 
          error: 'No identifier provided (EAN, ASIN, or product name)',
          details: { productEan, productAsin, product_name: productName }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[AMAZON-ENRICH] Identifiers:', { productEan, productAsin, product_name: productName });

    // 2. Obtenir le token Amazon valide
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('amazon-token-manager');
    
    if (tokenError) {
      console.error('[AMAZON-ENRICH] Token error:', tokenError);
      throw new Error(`Token error: ${tokenError.message}`);
    }

    const { access_token } = tokenData;
    console.log('[AMAZON-ENRICH] Token obtained');

    // 3. Récupérer les credentials AWS et marketplace ID
    const { data: credentials, error: credError } = await supabase
      .from('aws_credentials')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credentials) {
      throw new Error('AWS credentials not configured in database');
    }

    const { data: amazonCreds } = await supabase
      .from('amazon_credentials')
      .select('marketplace_id')
      .eq('is_active', true)
      .maybeSingle();

    const marketplaceId = amazonCreds?.marketplace_id || 'A13V1IB3VIYZZH';
    const region = credentials.region || 'eu-west-1';

    console.log('[AMAZON-ENRICH] AWS config loaded:', { region, marketplaceId });

    // 4. AssumeRole pour obtenir credentials temporaires
    const stsClient = new STSClient({
      region,
      credentials: {
        accessKeyId: credentials.access_key_id_encrypted,
        secretAccessKey: credentials.secret_access_key_encrypted,
      },
    });

    const assumeRoleCmd = new AssumeRoleCommand({
      RoleArn: credentials.role_arn,
      RoleSessionName: `amazon-enrich-${Date.now()}`,
      DurationSeconds: 3600,
    });

    const stsResponse = await stsClient.send(assumeRoleCmd);
    const tempCreds = stsResponse.Credentials;

    if (!tempCreds?.AccessKeyId || !tempCreds?.SecretAccessKey || !tempCreds?.SessionToken) {
      throw new Error('Failed to assume AWS role');
    }

    console.log('[AMAZON-ENRICH] STS AssumeRole successful');

    // Helper: Signer une requête Amazon SP-API
    const signedAmazonRequest = async (path: string, queryParams: URLSearchParams) => {
      const signer = new SignatureV4({
        service: 'execute-api',
        region,
        credentials: {
          accessKeyId: tempCreds.AccessKeyId!,
          secretAccessKey: tempCreds.SecretAccessKey!,
          sessionToken: tempCreds.SessionToken!,
        },
        sha256: Sha256,
      });

      const url = new URL(`https://sellingpartnerapi-eu.amazon.com${path}?${queryParams}`);
      const request = new HttpRequest({
        method: 'GET',
        protocol: 'https:',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'host': url.hostname,
          'x-amz-access-token': access_token,
          'Accept': 'application/json',
        },
      });

      const signedRequest = await signer.sign(request);
      
      return fetch(url.toString(), {
        method: signedRequest.method,
        headers: signedRequest.headers as HeadersInit,
      });
    };
    
    console.log('[AMAZON-ENRICH] Search config:', { 
      marketplaceId, 
      hasAsin: !!productAsin, 
      hasEan: !!productEan, 
      hasName: !!productName 
    });

    // 5. Appeler Amazon SP-API Catalog Items avec SigV4
    const catalogPath = '/catalog/2022-04-01/items';
    
    let amazonData;
    let searchMethod: string = 'UNKNOWN';

    // Essayer d'abord avec ASIN si fourni
    if (productAsin) {
      searchMethod = 'ASIN';
      const params = new URLSearchParams({
        identifiers: productAsin,
        identifiersType: 'ASIN',
        marketplaceIds: marketplaceId,
        includedData: 'summaries,attributes,images,productTypes,salesRanks',
      });

      console.log('[AMAZON-ENRICH] Calling Amazon API with ASIN (SigV4)...', { region, marketplaceId });
      const amazonResponse = await signedAmazonRequest(catalogPath, params);

      if (amazonResponse.ok) {
        amazonData = await amazonResponse.json();
      } else {
        const errorText = await amazonResponse.text();
        console.error('[AMAZON-ENRICH] Amazon API error (ASIN):', {
          status: amazonResponse.status,
          statusText: amazonResponse.statusText,
          body: errorText
        });
        
        if (amazonResponse.status === 403) {
          throw new Error('AWS credentials or IAM permissions issue - Check API Keys configuration');
        }
      }
    }

    // Si pas de résultat avec ASIN, essayer avec EAN
    if (!amazonData?.items?.length && productEan) {
      searchMethod = 'EAN';
      const params = new URLSearchParams({
        identifiers: productEan,
        identifiersType: 'EAN',
        marketplaceIds: marketplaceId,
        includedData: 'summaries,attributes,images,productTypes,salesRanks',
      });

      console.log('[AMAZON-ENRICH] Calling Amazon API with EAN (SigV4)...', { region, marketplaceId });
      const amazonResponse = await signedAmazonRequest(catalogPath, params);

      if (amazonResponse.ok) {
        amazonData = await amazonResponse.json();
      } else {
        const errorText = await amazonResponse.text();
        console.error('[AMAZON-ENRICH] Amazon API error (EAN):', {
          status: amazonResponse.status,
          statusText: amazonResponse.statusText,
          body: errorText
        });
        
        if (amazonResponse.status === 403) {
          throw new Error('AWS credentials or IAM permissions issue - Check API Keys configuration');
        }
      }
    }

    // Si toujours pas de résultat, essayer avec le nom du produit (keywords)
    if (!amazonData?.items?.length && productName) {
      searchMethod = 'KEYWORDS';
      const params = new URLSearchParams({
        keywords: productName,
        marketplaceIds: marketplaceId,
        includedData: 'summaries,attributes,images,productTypes,salesRanks',
      });

      console.log('[AMAZON-ENRICH] Calling Amazon API with keywords (SigV4)...', { region, marketplaceId });
      const amazonResponse = await signedAmazonRequest(catalogPath, params);

      if (amazonResponse.ok) {
        amazonData = await amazonResponse.json();
      } else {
        const errorText = await amazonResponse.text();
        console.error('[AMAZON-ENRICH] Amazon API error (KEYWORDS):', {
          status: amazonResponse.status,
          statusText: amazonResponse.statusText,
          body: errorText
        });
        
        if (amazonResponse.status === 403) {
          throw new Error('AWS credentials or IAM permissions issue - Check API Keys configuration');
        }
      }
    }

    console.log('[AMAZON-ENRICH] Data received:', amazonData?.items?.length || 0, 'items via', searchMethod, '(region:', region, ')');

    if (!amazonData?.items || amazonData.items.length === 0) {
      // Marquer comme "not_found" et retourner 404 (pas d'exception)
      await supabase
        .from('product_analyses')
        .update({ 
          amazon_enrichment_status: 'not_found',
          amazon_last_attempt: new Date().toISOString()
        })
        .eq('id', analysisId);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          status: 'not_found',
          message: 'Product not found on Amazon',
          searchMethod,
          identifiers: { ean: productEan, asin: productAsin, name: productName }
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Parser et formater les données
    const item = amazonData.items[0];
    const summaries = item.summaries?.[0] || {};
    const attributes = item.attributes || {};
    const images = item.images || [];
    const salesRanks = item.salesRanks || [];

    const formattedData = {
      analysis_id: analysisId,
      user_id: userId,
      asin: item.asin,
      ean: productEan || item.identifiers?.ean?.[0],
      title: summaries.itemName,
      brand: summaries.brand,
      manufacturer: summaries.manufacturer,
      product_type: summaries.productType,
      
      // Prix
      list_price: summaries.msrp?.amount,
      
      // Images
      images: images.map((img: any) => ({
        url: img.images?.[0]?.link,
        variant: img.variant,
        height: img.images?.[0]?.height,
        width: img.images?.[0]?.width,
      })),
      
      // Dimensions
      item_dimensions: attributes.item_dimensions?.[0],
      package_dimensions: attributes.package_dimensions?.[0],
      item_weight: attributes.item_weight?.[0]?.value,
      package_weight: attributes.package_weight?.[0]?.value,
      
      // Ventes
      sales_rank: salesRanks.map((rank: any) => ({
        category: rank.displayGroupTitle,
        rank: rank.rank,
      })),
      
      // Features
      features: attributes.bullet_point || [],
      color: attributes.color?.[0]?.value,
      size: attributes.size?.[0]?.value,
      
      // Données brutes
      raw_data: amazonData,
      last_synced_at: new Date().toISOString(),
    };

    console.log('[AMAZON-ENRICH] Formatted data ready, saving to database...');

    // 6. Upsert dans la base de données
    const { data: savedData, error: saveError } = await supabase
      .from('amazon_product_data')
      .upsert(formattedData, { onConflict: 'analysis_id' })
      .select()
      .single();

    if (saveError) {
      console.error('[AMAZON-ENRICH] Save error:', saveError);
      throw saveError;
    }

    console.log('[AMAZON-ENRICH] Data saved successfully');
    await logToDatabase('info', 'Success', 'Données Amazon sauvegardées avec succès');

    // Mettre à jour le statut à "success"
    await supabase
      .from('product_analyses')
      .update({ amazon_enrichment_status: 'success' })
      .eq('id', analysisId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: savedData,
        message: 'Amazon data synchronized successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AMAZON-ENRICH] Error:', error);
    
    // Log l'erreur dans la base de données
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);
      
      await supabaseClient.from('amazon_edge_logs').insert({
        function_name: 'amazon-product-enrichment',
        level: 'error',
        event_type: 'Error',
        event_message: `Erreur: ${error.message || 'Unknown error'}`,
        metadata: { 
          stack: error.stack,
          analysis_id: analysisIdRef
        }
      });
    } catch (logError) {
      console.error('[LOG-ERROR]', logError);
    }
    
    // Déterminer le code HTTP selon le type d'erreur
    let httpStatus = 500;
    let errorStatus = 'error';
    
    if (error.message?.includes('not authenticated') || error.message?.includes('User not authenticated')) {
      httpStatus = 401;
      errorStatus = 'error';
    } else if (error.message?.includes('not found') || error.message?.includes('analysis not found')) {
      httpStatus = 404;
      errorStatus = 'not_found';
    } else if (error.message?.includes('Token error')) {
      httpStatus = 502;
      errorStatus = 'error';
    }
    
    // Mettre à jour le statut en base (si on a un analysisIdRef)
    if (analysisIdRef) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);
        
        await supabaseClient
          .from('product_analyses')
          .update({ 
            amazon_enrichment_status: errorStatus,
            amazon_last_attempt: new Date().toISOString()
          })
          .eq('id', analysisIdRef);
      } catch (updateError) {
        console.error('[AMAZON-ENRICH] Failed to update status:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error',
        code: errorStatus,
        details: error.toString()
      }),
      { 
        status: httpStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

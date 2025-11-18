import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { productAnalysisSchema } from "../_shared/validation-schemas.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Vérifier la clé API
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash la clé pour la comparer
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Vérifier la clé dans la DB
    const { data: apiKeyData, error: keyError } = await supabaseClient
      .from('api_keys')
      .select('user_id, is_active, permissions, rate_limit')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .maybeSingle();

    if (keyError || !apiKeyData) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mettre à jour last_used_at
    await supabaseClient
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyHash);

    const userId = apiKeyData.user_id;
    const permissions = apiKeyData.permissions as any;

    const url = new URL(req.url);
    const path = url.pathname.split('/api/')[1];
    const method = req.method;

    // Router API
    if (path === 'products') {
      if (method === 'GET') {
        if (!permissions.read) {
          return new Response(
            JSON.stringify({ error: 'Read permission required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: products, error } = await supabaseClient
          .from('product_analyses')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        return new Response(
          JSON.stringify({ products }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'POST') {
        if (!permissions.write) {
          return new Response(
            JSON.stringify({ error: 'Write permission required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        
        // Validate input using zod schema
        const validationResult = productAnalysisSchema.safeParse(body);
        if (!validationResult.success) {
          return new Response(
            JSON.stringify({ 
              error: 'Invalid input data',
              details: validationResult.error.errors 
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        // Create product analysis with validated data
        const { data, error } = await supabaseClient
          .from('product_analyses')
          .insert({
            user_id: userId,
            ...validationResult.data,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ product: data }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (path?.startsWith('products/')) {
      const productId = path.split('/')[1];

      if (method === 'GET') {
        if (!permissions.read) {
          return new Response(
            JSON.stringify({ error: 'Read permission required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: product, error } = await supabaseClient
          .from('product_analyses')
          .select('*')
          .eq('id', productId)
          .eq('user_id', userId)
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ product }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'PUT') {
        if (!permissions.write) {
          return new Response(
            JSON.stringify({ error: 'Write permission required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();

        const { data, error } = await supabaseClient
          .from('product_analyses')
          .update({ analysis_result: body })
          .eq('id', productId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ product: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'DELETE') {
        if (!permissions.delete) {
          return new Response(
            JSON.stringify({ error: 'Delete permission required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabaseClient
          .from('product_analyses')
          .delete()
          .eq('id', productId)
          .eq('user_id', userId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Route pour les fournisseurs
    if (path === 'suppliers') {
      if (method === 'GET' && permissions.read) {
        const { data: suppliers, error } = await supabaseClient
          .from('supplier_configurations')
          .select('*')
          .eq('user_id', userId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ suppliers }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('API endpoint error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// PrestaShop Connection Tester - Version 1.0.1
// Last updated: 2025-10-15 16:16:00 UTC
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

console.log('[PRESTASHOP-TEST] Function loaded - Version 1.0.1');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrestaShopConfig {
  url: string;
  apiKey: string;
  apiSecret?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, apiKey, apiSecret } = await req.json() as PrestaShopConfig;

    if (!url || !apiKey) {
      throw new Error('URL et clé API requis');
    }

    // Nettoyer l'URL
    const cleanUrl = url.replace(/\/$/, '');
    
    // Construire l'URL de test (récupérer les infos du shop)
    const testUrl = `${cleanUrl}/api`;
    
    console.log('[PRESTASHOP-TEST] Testing connection to:', testUrl);

    // Créer les headers d'authentification
    const authString = `${apiKey}:${apiSecret || ''}`;
    const authHeader = `Basic ${btoa(authString)}`;

    // Tester la connexion en récupérant les infos du shop
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Output-Format': 'JSON',
      },
    });

    console.log('[PRESTASHOP-TEST] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PRESTASHOP-TEST] Error response:', errorText);
      
      if (response.status === 401) {
        throw new Error('Authentification échouée. Vérifiez vos identifiants.');
      } else if (response.status === 404) {
        throw new Error('API introuvable. Vérifiez l\'URL de votre boutique.');
      } else {
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }
    }

    // Tester l'accès aux produits
    const productsUrl = `${cleanUrl}/api/products?display=[id,name]&limit=5`;
    const productsResponse = await fetch(productsUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Output-Format': 'JSON',
      },
    });

    if (!productsResponse.ok) {
      throw new Error('Impossible d\'accéder aux produits');
    }

    const productsData = await productsResponse.json();
    const productCount = productsData.products?.length || 0;

    console.log('[PRESTASHOP-TEST] Connection successful, found', productCount, 'sample products');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Connexion réussie à PrestaShop',
        details: {
          url: cleanUrl,
          apiEnabled: true,
          sampleProductCount: productCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PRESTASHOP-TEST] Test failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

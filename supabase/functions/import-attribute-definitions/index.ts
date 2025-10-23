import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent } = await req.json();
    
    if (!csvContent) {
      throw new Error("Le contenu CSV est requis");
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[import-attributes] Début de l\'import du référentiel d\'attributs');

    // Parser le CSV (format: Attribut;Value)
    const lines = csvContent.split('\n').filter((line: string) => line.trim() !== '');
    const attributes = [];

    for (let i = 1; i < lines.length; i++) { // Skip header
      const [attributeName, attributeValue] = lines[i].split(';').map((s: string) => s.trim());
      
      if (attributeName && attributeValue) {
        attributes.push({
          attribute_name: attributeName,
          attribute_value: attributeValue,
          category: 'hottes'
        });
      }
    }

    console.log(`[import-attributes] ${attributes.length} attributs à importer`);

    // Supprimer les anciennes données
    const { error: deleteError } = await supabase
      .from('product_attribute_definitions')
      .delete()
      .eq('category', 'hottes');

    if (deleteError) {
      console.error('[import-attributes] Erreur lors de la suppression:', deleteError);
      throw deleteError;
    }

    // Insérer les nouveaux attributs par batch
    const batchSize = 100;
    for (let i = 0; i < attributes.length; i += batchSize) {
      const batch = attributes.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('product_attribute_definitions')
        .insert(batch);

      if (insertError) {
        console.error('[import-attributes] Erreur lors de l\'insertion batch:', insertError);
        throw insertError;
      }
    }

    console.log('[import-attributes] Import terminé avec succès');

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: attributes.length,
        message: `${attributes.length} attributs importés avec succès`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[import-attributes] Erreur globale:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { analysis_id, force_regenerate = false } = await req.json();

    console.log(`[RSGP-COMPLIANCE] Generating for analysis: ${analysis_id}`);

    if (!analysis_id) {
      return new Response(
        JSON.stringify({ error: 'analysis_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already exists
    if (!force_regenerate) {
      const { data: existing } = await supabase
        .from('rsgp_compliance')
        .select('*')
        .eq('analysis_id', analysis_id)
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            data: existing,
            message: 'RSGP compliance data already exists'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get product analysis data
    const { data: analysis } = await supabase
      .from('product_analyses')
      .select('*')
      .eq('id', analysis_id)
      .eq('user_id', user.id)
      .single();

    if (!analysis) {
      return new Response(
        JSON.stringify({ error: 'Analysis not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Amazon data if available
    const { data: amazonData } = await supabase
      .from('amazon_product_data')
      .select('*')
      .eq('analysis_id', analysis_id)
      .single();

    // Web search for manufacturer and compliance data
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    let searchResults = [];

    if (SERPER_API_KEY) {
      const searches = [
        `${analysis.product_name} ${amazonData?.ean || ''} notice fabricant PDF`,
        `${amazonData?.brand || analysis.product_name} conformité CE certificat`,
        `${analysis.product_name} déclaration conformité européenne`
      ];

      const searchPromises = searches.map(async (query) => {
        try {
          const res = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': SERPER_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: query, num: 5 })
          });
          const data = await res.json();
          return data.organic || [];
        } catch (error) {
          console.error('[RSGP] Search error:', error);
          return [];
        }
      });

      const results = await Promise.all(searchPromises);
      searchResults = results.flat();
    }

    // Build AI prompt for RSGP compliance
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const rsgpPrompt = `Tu es un expert en conformité européenne et en sécurité produit (Règlement (UE) 2023/988 – RSGP).

Ta mission est de générer un tableau JSON complet contenant **toutes les informations obligatoires et recommandées** pour la conformité RSGP d'un produit vendu en ligne.

DONNÉES PRODUIT :
- Nom : ${analysis.product_name}
- EAN : ${amazonData?.ean || 'non communiqué'}
- Marque : ${amazonData?.brand || 'non communiqué'}
- Catégorie : ${analysis.category || 'non communiqué'}
- Fabricant : ${amazonData?.manufacturer || 'non communiqué'}
- Description : ${analysis.description || 'non communiqué'}
- Pays origine : ${amazonData?.buy_box_ship_country || 'non communiqué'}

DONNÉES WEB TROUVÉES :
${searchResults.slice(0, 10).map((r, i) => `Source ${i+1}: ${r.title} - ${r.snippet}`).join('\n')}

CHAMPS OBLIGATOIRES À REMPLIR (format JSON) :
{
  "nom_produit": "${analysis.product_name}",
  "reference_interne": "",
  "ean": "${amazonData?.ean || ''}",
  "numero_lot": "",
  "numero_modele": "${amazonData?.numero_modele || ''}",
  "categorie_rsgp": "Déterminer selon la catégorie du produit",
  "fabricant_nom": "${amazonData?.manufacturer || ''}",
  "fabricant_adresse": "Adresse postale complète si disponible",
  "pays_origine": "${amazonData?.buy_box_ship_country || ''}",
  "personne_responsable_ue": "Nom et adresse du responsable UE",
  "normes_ce": ["Liste des normes applicables"],
  "documents_conformite": {
    "declaration_conformite": "URL ou 'non communiqué'",
    "certificat_ce": "URL ou 'non communiqué'",
    "rapport_test": "URL ou 'non communiqué'"
  },
  "evaluation_risque": "Description de l'évaluation des risques",
  "date_evaluation": "YYYY-MM-DD",
  "firmware_ou_logiciel": "Version ou N/A",
  "procedure_rappel": "Procédure en cas de rappel",
  "historique_incidents": [],
  "notice_pdf": "URL notice utilisateur",
  "avertissements": ["Liste d'avertissements pertinents"],
  "age_recommande": "3+ ans ou Adultes",
  "compatibilites": ["Compatible avec X"],
  "entretien": "Instructions d'entretien",
  "recyclage": "Instructions de recyclage",
  "indice_reparabilite": 0.0,
  "indice_energie": "A++ ou N/A",
  "garantie": "24 mois",
  "service_consommateur": "Email et téléphone",
  "langues_disponibles": ["fr", "en"],
  "rsgp_valide": false,
  "date_mise_conformite": null,
  "responsable_conformite": "",
  "documents_archives": {},
  "fournisseur": "${amazonData?.buy_box_seller_name || ''}",
  "date_import_odoo": null
}

RÈGLES IMPORTANTES :
1. Pour chaque champ, donne une valeur précise et vérifiée
2. Si une donnée est inconnue, indique "non communiqué"
3. Utilise les données web pour compléter fabricant, normes, documents
4. Détermine la catégorie RSGP selon la classification produit (jouets, électronique, textile, etc.)
5. Sois rigoureux sur les formats (dates ISO, codes pays)
6. Retourne UNIQUEMENT le JSON valide, sans texte markdown ni commentaires`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Tu es un expert RSGP. Retourne UNIQUEMENT du JSON valide, sans markdown.' },
          { role: 'user', content: rsgpPrompt }
        ]
      })
    });

    if (!aiResponse.ok) {
      throw new Error('AI request failed');
    }

    const aiData = await aiResponse.json();
    let aiContent = aiData.choices?.[0]?.message?.content || '{}';

    // Clean markdown if present
    aiContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let rsgpData;
    try {
      rsgpData = JSON.parse(aiContent);
    } catch (parseError) {
      console.error('[RSGP] JSON parse error:', parseError, 'Content:', aiContent);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Sanitize date fields before insertion (convert "non communiqué" to null)
    const sanitizeDateFields = (data: any) => {
      const dateFields = ['date_evaluation', 'date_mise_conformite', 'date_import_odoo'];
      dateFields.forEach(field => {
        if (data[field] === 'non communiqué' || data[field] === '' || !data[field]) {
          data[field] = null;
        }
      });
      return data;
    };

    const sanitizedData = sanitizeDateFields(rsgpData);

    // Save to database using UPSERT
    const { data: complianceRecord, error: insertError } = await supabase
      .from('rsgp_compliance')
      .upsert({
        analysis_id,
        user_id: user.id,
        ...sanitizedData,
        validation_status: 'draft'
      }, {
        onConflict: 'analysis_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[RSGP] Database insert error:', insertError);
      throw insertError;
    }

    // Update product_analyses
    await supabase
      .from('product_analyses')
      .update({
        rsgp_compliance_id: complianceRecord.id,
        enrichment_status: {
          ...(analysis.enrichment_status || {}),
          rsgp: 'completed'
        }
      })
      .eq('id', analysis_id);

    console.log('[RSGP] Compliance data generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: complianceRecord
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RSGP-COMPLIANCE] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
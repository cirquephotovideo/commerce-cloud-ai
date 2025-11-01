import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResearchCycle {
  query: string;
  findings: string;
  knowledgeGaps: string[];
  sources: string[];
}

interface DeepResearchResult {
  cycles: ResearchCycle[];
  finalSynthesis: {
    long_description: string;
    specifications: any;
    cost_analysis: any;
    hs_code: string | null;
    rsgp_compliance: any;
  };
  allSources: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
  totalCycles: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let analysisIdForError: string | undefined;
  
  try {
    const { analysisId, productData, purchasePrice, maxCycles = 3 } = await req.json();
    analysisIdForError = analysisId;
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[DEEP-RESEARCH] 🔬 Starting deep research for:', analysisId, 'with', maxCycles, 'max cycles');

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Import AI fallback helper
    const { callAIWithFallback } = await import('../_shared/ai-fallback.ts');

    // Update status to processing
    await supabase
      .from('product_analyses')
      .update({
        enrichment_status: {
          specifications: 'processing',
          cost_analysis: 'processing',
          technical_description: 'processing',
          images: 'processing',
          rsgp: 'processing'
        }
      })
      .eq('id', analysisId);

    // Research cycles storage
    const cycles: ResearchCycle[] = [];
    const allSources: string[] = [];
    let currentKnowledgeGaps: string[] = [];

    // Initial research query
    const initialQuery = `${productData.name} ${productData.brand || ''} ${productData.supplier_reference || productData.ean || ''}`.trim();
    
    console.log('[DEEP-RESEARCH] 📝 Initial query:', initialQuery);

    // Cycle 1: Initial broad research
    for (let cycleNum = 0; cycleNum < maxCycles; cycleNum++) {
      console.log(`[DEEP-RESEARCH] 🔄 Cycle ${cycleNum + 1}/${maxCycles}`);

      // Determine query for this cycle
      let cycleQuery: string;
      if (cycleNum === 0) {
        cycleQuery = initialQuery;
      } else if (currentKnowledgeGaps.length > 0) {
        // Focus on the first knowledge gap
        cycleQuery = `${initialQuery} ${currentKnowledgeGaps[0]}`;
      } else {
        // No more gaps, stop early
        console.log('[DEEP-RESEARCH] ✅ No more knowledge gaps, stopping early');
        break;
      }

      // Research prompt for this cycle
      const researchPrompt = `Tu es un expert en recherche web approfondie. 

${cycleNum === 0 ? 'Effectue une recherche initiale' : `Effectue une recherche ciblée sur les lacunes suivantes: ${currentKnowledgeGaps.join(', ')}`} pour ce produit:

Produit: ${productData.name}
Marque: ${productData.brand || 'Inconnue'}
Référence: ${productData.supplier_reference || productData.ean || 'N/A'}
EAN: ${productData.ean || 'Non disponible'}
${purchasePrice ? `Prix d'achat: ${purchasePrice} EUR` : ''}

${cycleNum > 0 ? `\n📚 Informations déjà collectées:\n${cycles.map((c, i) => `Cycle ${i + 1}: ${c.findings.substring(0, 200)}...`).join('\n\n')}` : ''}

**CONSIGNES**:
1. Effectue une recherche web approfondie
2. Collecte des informations RÉELLES et VÉRIFIABLES
3. Note toutes les URLs sources consultées
4. Identifie les lacunes d'information restantes

Réponds UNIQUEMENT en JSON valide:

{
  "findings": "Résumé détaillé des découvertes de cette recherche (200-400 mots)",
  "data_collected": {
    "specifications": "Spécifications techniques trouvées",
    "pricing": "Informations de prix du marché",
    "certifications": "Certifications et conformités",
    "technical_details": "Détails techniques"
  },
  "sources": ["URL1", "URL2", "URL3"],
  "knowledge_gaps": ["Lacune 1", "Lacune 2"],
  "confidence": "low|medium|high"
}`;

      // Call AI with web search capability
      const researchResponse = await callAIWithFallback({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un assistant de recherche qui répond UNIQUEMENT en JSON valide. Tu effectues des recherches web approfondies et structures les résultats.' 
          },
          { role: 'user', content: researchPrompt }
        ],
        web_search: true,
        temperature: 0.5
      });

      if (!researchResponse.success) {
        console.error(`[DEEP-RESEARCH] ❌ Cycle ${cycleNum + 1} failed:`, researchResponse.error);
        throw new Error(`Research cycle ${cycleNum + 1} failed: ${researchResponse.error}`);
      }

      // Parse research results
      let cycleData;
      try {
        const cleanContent = (researchResponse.content || '')
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        cycleData = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('[DEEP-RESEARCH] ❌ Failed to parse cycle JSON:', parseError);
        throw new Error(`Failed to parse research cycle ${cycleNum + 1} results`);
      }

      // Store cycle results
      const cycle: ResearchCycle = {
        query: cycleQuery,
        findings: cycleData.findings || '',
        knowledgeGaps: cycleData.knowledge_gaps || [],
        sources: cycleData.sources || []
      };

      cycles.push(cycle);
      allSources.push(...cycle.sources);
      currentKnowledgeGaps = cycle.knowledgeGaps;

      console.log(`[DEEP-RESEARCH] Cycle ${cycleNum + 1} complete:`, {
        findingsLength: cycle.findings.length,
        sourcesCount: cycle.sources.length,
        gapsCount: cycle.knowledgeGaps.length
      });

      // Update queue with progress
      await supabase
        .from('enrichment_queue')
        .update({
          error_message: `Deep research in progress: cycle ${cycleNum + 1}/${maxCycles}`,
          last_error: {
            timestamp: new Date().toISOString(),
            status: 'progress',
            cycles_completed: cycleNum + 1
          }
        })
        .eq('analysis_id', analysisId);
    }

    console.log('[DEEP-RESEARCH] 🎯 All research cycles complete, synthesizing final results...');

    // Final synthesis: consolidate all findings into structured product data
    const synthesisPrompt = `Tu es un expert en catalogage produit e-commerce. Synthétise toutes les recherches effectuées pour créer un enrichissement complet.

Produit: ${productData.name}
Marque: ${productData.brand || 'Inconnue'}
Prix d'achat: ${purchasePrice || 'Non renseigné'} EUR

📚 Résultats des ${cycles.length} cycles de recherche:

${cycles.map((c, i) => `
=== CYCLE ${i + 1} ===
Requête: ${c.query}
Découvertes: ${c.findings}
Sources: ${c.sources.join(', ')}
Lacunes identifiées: ${c.knowledgeGaps.join(', ') || 'Aucune'}
`).join('\n\n')}

**CONSIGNES**:
1. Consolide TOUTES les informations collectées
2. Crée une description marketing détaillée et convaincante
3. Structure les spécifications techniques
4. Analyse le positionnement prix et marge recommandée
5. Indique le niveau de confiance global

Réponds UNIQUEMENT en JSON valide:

{
  "long_description": "Description marketing complète de 600-1000 mots basée sur TOUTES les recherches",
  "specifications": {
    "dimensions": { "length": null, "width": null, "height": null, "unit": "cm" },
    "weight": { "value": null, "unit": "kg" },
    "materials": [],
    "certifications": [],
    "technical_details": "Détails techniques consolidés"
  },
  "cost_analysis": {
    "market_price_range": { "min": null, "max": null, "currency": "EUR" },
    "recommended_margin": null,
    "recommended_selling_price": null,
    "analysis_notes": "Analyse basée sur tous les prix trouvés"
  },
  "hs_code": "Code douanier suggéré (8 chiffres) ou null",
  "rsgp_compliance": {
    "repairability_index": null,
    "environmental_score": "Inconnu",
    "certifications": []
  },
  "confidence_level": "high|medium|low",
  "synthesis_notes": "Notes sur la qualité et complétude des données collectées"
}`;

    const synthesisResponse = await callAIWithFallback({
      model: 'google/gemini-2.5-flash',
      messages: [
        { 
          role: 'system', 
          content: 'Tu es un expert en catalogage produit. Tu analyses et synthétises des données de recherche pour créer des fiches produit complètes. Tu réponds UNIQUEMENT en JSON valide.' 
        },
        { role: 'user', content: synthesisPrompt }
      ],
      temperature: 0.3,
      max_tokens: 3000
    });

    if (!synthesisResponse.success) {
      throw new Error(`Synthesis failed: ${synthesisResponse.error}`);
    }

    // Parse synthesis
    let finalSynthesis;
    try {
      const cleanContent = (synthesisResponse.content || '')
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      finalSynthesis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[DEEP-RESEARCH] ❌ Failed to parse synthesis JSON:', parseError);
      throw new Error('Failed to parse final synthesis');
    }

    // Update product_analyses with enriched data
    const { data: currentAnalysis } = await supabase
      .from('product_analyses')
      .select('analysis_result')
      .eq('id', analysisId)
      .single();

    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        long_description: finalSynthesis.long_description,
        specifications: finalSynthesis.specifications,
        cost_analysis: finalSynthesis.cost_analysis,
        analysis_result: {
          ...currentAnalysis?.analysis_result,
          hs_code: finalSynthesis.hs_code,
          rsgp_compliance: finalSynthesis.rsgp_compliance,
          _enriched_with_deep_research: true,
          _research_cycles: cycles.length,
          _research_timestamp: new Date().toISOString(),
          _all_sources: [...new Set(allSources)], // Deduplicate sources
          _confidence_level: finalSynthesis.confidence_level,
          _synthesis_notes: finalSynthesis.synthesis_notes
        },
        enrichment_status: {
          specifications: 'completed',
          cost_analysis: 'completed',
          technical_description: 'completed',
          images: 'completed',
          rsgp: 'completed'
        }
      })
      .eq('id', analysisId);

    if (updateError) {
      console.error('[DEEP-RESEARCH] ❌ Database update error:', updateError);
      throw updateError;
    }

    // Update enrichment_queue
    await supabase
      .from('enrichment_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: null
      })
      .eq('analysis_id', analysisId);

    const result: DeepResearchResult = {
      cycles,
      finalSynthesis,
      allSources: [...new Set(allSources)],
      confidenceLevel: finalSynthesis.confidence_level,
      totalCycles: cycles.length
    };

    console.log('[DEEP-RESEARCH] ✅ Deep research completed successfully:', {
      cycles: result.totalCycles,
      sources: result.allSources.length,
      confidence: result.confidenceLevel
    });

    return new Response(
      JSON.stringify({
        success: true,
        result,
        message: `Deep research completed with ${result.totalCycles} cycles and ${result.allSources.length} sources`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[DEEP-RESEARCH] ❌ Fatal error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Update enrichment_queue with error
    if (analysisIdForError) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        await supabase
          .from('enrichment_queue')
          .update({
            status: 'failed',
            error_message: `Deep research failed: ${error.message}`,
            completed_at: new Date().toISOString(),
            last_error: {
              timestamp: new Date().toISOString(),
              type: 'fatal',
              message: error.message,
              stack: error.stack?.substring(0, 500)
            }
          })
          .eq('analysis_id', analysisIdForError);
      } catch (updateError) {
        console.error('[DEEP-RESEARCH] Failed to update queue:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.stack?.substring(0, 200)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

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
    const { 
      analysisId, 
      productData, 
      purchasePrice,
      preferred_model = 'qwen3-coder:480b-cloud',
      web_search_enabled = true 
    } = await req.json();

    console.log('[RSGP-OLLAMA] Starting analysis for:', analysisId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer l'analyse existante
    const { data: analysis, error: analysisError } = await supabaseClient
      .from('product_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      throw new Error('Analysis not found');
    }

    // Template JSON complet pour RSGP
    const rsgpTemplate = {
      identification_produit: {
        marque: "",
        modele: "",
        reference_commerciale: "",
        code_ean: "",
        categorie: "",
        sous_categorie: "",
        annee_fabrication: "",
        pays_origine: "",
        couleurs_disponibles: []
      },
      caracteristiques_techniques: {
        dimensions: {
          hauteur_cm: 0,
          largeur_cm: 0,
          profondeur_cm: 0,
          poids_kg: 0,
          volume_utile_litres: 0
        },
        alimentation_electrique: {
          tension_v: 0,
          frequence_hz: 0,
          puissance_nominale_w: 0,
          puissance_max_w: 0,
          type_prise: "",
          longueur_cable_m: 0
        },
        performances: {
          classe_energetique: "",
          consommation_annuelle_kwh: 0,
          niveau_sonore_db: 0,
          capacite: 0,
          unite_capacite: ""
        },
        fonctionnalites: {
          connectivite: {
            wifi: false,
            bluetooth: false,
            application_mobile: "",
            commande_vocale: []
          },
          securite_enfants: false,
          depart_differe: false
        }
      },
      normes_certifications: {
        marquage_ce: true,
        normes_electriques: {
          basse_tension: "",
          compatibilite_electromagnetique: "",
          autres_normes: []
        },
        certifications_qualite: {
          iso_9001: false,
          nf: false,
          gs: false,
          autres: []
        },
        certifications_environnementales: {
          energie_star: false,
          ecolabel_europeen: false,
          autres: []
        },
        certifications_securite: {
          rohs: true,
          reach: true,
          autres: []
        }
      },
      etiquette_energetique: {
        nouvelle_etiquette_2021: true,
        classe_efficacite_energetique: "",
        consommation_100_cycles_kwh: 0,
        niveau_bruit_fonctionnement_db: 0
      },
      rgpd_protection_donnees: {
        collecte_donnees: {
          donnees_collectees: [],
          finalite_traitement: [],
          duree_conservation: ""
        },
        responsable_traitement: {
          nom: "",
          adresse: "",
          email_dpo: "",
          site_politique_confidentialite: ""
        },
        droits_utilisateur: {
          droit_acces: true,
          droit_rectification: true,
          droit_effacement: true,
          modalites_exercice: "",
          delai_reponse_jours: 30
        },
        securite_donnees: {
          chiffrement: {
            donnees_repos: false,
            donnees_transit: false,
            protocole: ""
          },
          stockage: {
            local: false,
            cloud: false,
            localisation_serveurs: ""
          }
        },
        conformite_reglementaire: {
          rgpd: {
            conforme: false,
            date_mise_conformite: ""
          }
        }
      },
      conformite_produit: {
        declaration_conformite: {
          disponible: true,
          url: "",
          normes_harmonisees: []
        },
        substances_reglementees: {
          rohs: {
            conforme: true,
            substances_controlees: []
          },
          reach: {
            conforme: true,
            substances_svhc: []
          }
        },
        fin_vie: {
          deee: {
            applicable: true,
            reprise_gratuite: true,
            eco_participation_euros: 0
          }
        }
      },
      sante_securite: {
        risques_identifies: [],
        mesures_prevention: [],
        precautions_emploi: [],
        emissions: {
          bruit: {
            niveau_db: 0,
            conforme_directive_bruit: true
          }
        },
        manuel_utilisation: {
          langues_disponibles: [],
          format_numerique: true,
          url_telechargement: ""
        }
      },
      garantie_service: {
        garantie_constructeur_mois: 0,
        duree_disponibilite_pieces_detachees_annees: 0,
        service_apres_vente: {
          telephone: "",
          email: "",
          site_web: ""
        }
      }
    };

    // Construire le prompt avec le template
    const prompt = `Tu es un expert en conformité produit et RSGP (Règlement Général sur la Sécurité des Produits).

PRODUIT À ANALYSER:
- Nom: ${productData.name || 'Non spécifié'}
- Marque: ${productData.brand || 'Non spécifiée'}
- EAN: ${productData.ean || 'Non spécifié'}
- Référence: ${productData.supplier_reference || 'Non spécifiée'}
- Prix d'achat: ${purchasePrice || 'Non spécifié'}€

INSTRUCTIONS:
1. Effectue une recherche web approfondie sur ce produit
2. Remplis le template JSON ci-dessous avec TOUTES les informations trouvées
3. Pour les données non trouvées, utilise null ou "Non communiqué"
4. Pour les booléens non confirmés, utilise false
5. Sois précis sur les chiffres (dimensions, puissance, etc.)
6. Si le produit N'EST PAS connecté (pas WiFi/Bluetooth), la section RGPD peut être simplifiée
7. Fournis les URLs officielles quand disponibles
8. IMPORTANT: Retourne UNIQUEMENT le JSON, sans texte avant ou après

TEMPLATE JSON À REMPLIR:
${JSON.stringify(rsgpTemplate, null, 2)}

RÉPONDS UNIQUEMENT AVEC LE JSON COMPLET, RIEN D'AUTRE.`;

    console.log('[RSGP-OLLAMA] Calling Ollama with web search enabled:', web_search_enabled);

    // Appeler Ollama via ollama-proxy sans authentification (service-to-service)
    const ollamaProxyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ollama-proxy`;
    const ollamaProxyResponse = await fetch(ollamaProxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pas de header Authorization pour les appels service-to-service
      },
      body: JSON.stringify({
        action: 'chat',
        model: preferred_model,
        web_search: web_search_enabled,
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un expert en conformité produit. Tu réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 16000
      })
    });

    if (!ollamaProxyResponse.ok) {
      const errorText = await ollamaProxyResponse.text();
      console.error('[RSGP-OLLAMA] Ollama proxy error:', errorText);
      throw new Error(`Ollama proxy error (${ollamaProxyResponse.status}): ${errorText}`);
    }

    const ollamaResponse = await ollamaProxyResponse.json();

    console.log('[RSGP-OLLAMA] Ollama response received');

    // Vérifier si la réponse est valide
    if (!ollamaResponse.success) {
      throw new Error(`Ollama proxy failed: ${ollamaResponse.error || 'Unknown error'}`);
    }

    // Extraire la réponse réelle depuis le wrapper d'ollama-proxy
    const actualResponse = ollamaResponse.response;
    
    // Parser la réponse JSON
    let rsgpData;
    try {
      // Récupérer le texte depuis différentes structures possibles
      const responseText = (
        actualResponse?.content ??
        actualResponse?.message?.content ??
        actualResponse?.choices?.[0]?.message?.content ??
        ''
      );

      // Log si le responseText est vide pour debugging
      if (!responseText || responseText.trim() === '') {
        console.error('[RSGP-OLLAMA] Empty response text from Ollama!');
        console.error('[RSGP-OLLAMA] ActualResponse structure:', JSON.stringify(actualResponse, null, 2));
      }

      // Helpers de normalisation / extraction
      const normalizeText = (t: string) => t
        .replace(/\r/g, '')
        .replace(/^\s*```json\s*|\s*```\s*$/g, '')
        .replace(/^\s*```\s*|\s*```\s*$/g, '')
        .trim();

      const stripTrailingCommas = (t: string) => t.replace(/,\s*([}\]])/g, '$1');

      const extractBalancedJson = (t: string) => {
        const firstBrace = t.indexOf('{');
        const firstBracket = t.indexOf('[');
        let start = -1, openChar = '{', closeChar = '}';
        if (firstBrace === -1 && firstBracket === -1) return null;
        if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
          start = firstBracket; openChar = '['; closeChar = ']';
        } else { start = firstBrace; }
        let depth = 0; let inString = false; let escape = false;
        for (let i = start; i < t.length; i++) {
          const ch = t[i];
          if (inString) {
            if (escape) { escape = false; }
            else if (ch === '\\') { escape = true; }
            else if (ch === '"') { inString = false; }
            continue;
          }
          if (ch === '"') { inString = true; continue; }
          if (ch === openChar) depth++;
          else if (ch === closeChar) {
            depth--;
            if (depth === 0) return t.slice(start, i + 1);
          }
        }
        return null;
      };

      // Nettoyer et tenter un parse direct
      let cleaned = normalizeText(responseText);
      try {
        rsgpData = JSON.parse(cleaned);
      } catch {}

      // Fallback: extraire le premier bloc JSON équilibré et réparer les virgules finales et guillemets typographiques
      if (!rsgpData) {
        const balanced = extractBalancedJson(cleaned) ?? extractBalancedJson(responseText);
        if (balanced) {
          const fixed = stripTrailingCommas(balanced)
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'");
          try { rsgpData = JSON.parse(fixed); } catch {}
        }
      }

      if (!rsgpData) {
        console.error('[RSGP-OLLAMA] JSON parse failed. Response snippet:', (responseText || '').slice(0, 500));
        throw new Error('Failed to parse Ollama JSON response');
      }

      console.log('[RSGP-OLLAMA] JSON parsed successfully');
    } catch (parseError) {
      console.error('[RSGP-OLLAMA] JSON parse error:', parseError);
      console.error('[RSGP-OLLAMA] Raw response shape:', {
        hasSuccess: Boolean(ollamaResponse?.success),
        hasResponse: Boolean(ollamaResponse?.response),
        hasContent: Boolean(actualResponse?.content),
        hasMessage: Boolean(actualResponse?.message?.content),
        hasChoices: Array.isArray(actualResponse?.choices),
      });
      throw new Error('Failed to parse Ollama JSON response');
    }

    // Mapper vers la structure existante + ajouter les données détaillées
    const mappedData = {
      // Structure existante (compatibilité)
      nom_produit: rsgpData.identification_produit?.marque && rsgpData.identification_produit?.modele
        ? `${rsgpData.identification_produit.marque} ${rsgpData.identification_produit.modele}`
        : productData.name,
      ean: rsgpData.identification_produit?.code_ean || productData.ean,
      fabricant_nom: rsgpData.identification_produit?.marque || productData.brand,
      fabricant_adresse: rsgpData.rgpd_protection_donnees?.responsable_traitement?.adresse || null,
      
      // Conformité
      normes_ce: rsgpData.normes_certifications?.marquage_ce || false,
      declaration_conformite: rsgpData.conformite_produit?.declaration_conformite?.disponible || false,
      
      // Documents
      documents_conformite: rsgpData.conformite_produit?.declaration_conformite?.url 
        ? [{ type: 'declaration_conformite', url: rsgpData.conformite_produit.declaration_conformite.url }]
        : [],
      
      // Risques
      evaluation_risque: {
        risques_identifies: rsgpData.sante_securite?.risques_identifies || [],
        mesures_prevention: rsgpData.sante_securite?.mesures_prevention || []
      },
      
      // Données détaillées complètes (nouveau)
      donnees_detaillees: rsgpData,
      
      // Métadonnées
      source_recherche: 'ollama_web_search',
      modele_utilise: preferred_model,
      date_analyse: new Date().toISOString()
    };

    // Sauvegarder dans product_analyses.rsgp_compliance
    const { error: updateError } = await supabaseClient
      .from('product_analyses')
      .update({
        rsgp_compliance: mappedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);

    if (updateError) {
      console.error('[RSGP-OLLAMA] Update error:', updateError);
      throw new Error(`Failed to update analysis: ${updateError.message}`);
    }

    // Optionnel: Sauvegarder aussi dans la table rsgp_compliance pour historique
    try {
      const { error: rsgpInsertError } = await supabaseClient
        .from('rsgp_compliance')
        .insert({
          analysis_id: analysisId,
          user_id: analysis.user_id,
          nom_produit: mappedData.nom_produit ?? productData?.name ?? null,
          ean: mappedData.ean ?? productData?.ean ?? null,
          documents_conformite: mappedData.documents_conformite ?? [],
          generated_at: new Date().toISOString(),
          generation_metadata: {
            source_recherche: mappedData.source_recherche,
            modele_utilise: mappedData.modele_utilise,
            date_analyse: mappedData.date_analyse,
            rsgp_json: rsgpData
          }
        });

      if (rsgpInsertError) {
        console.warn('[RSGP-OLLAMA] Failed to insert in rsgp_compliance table:', rsgpInsertError);
      }
    } catch (historyError) {
      console.warn('[RSGP-OLLAMA] History insert non-blocking error:', historyError);
      // Non bloquant
    }

    console.log('[RSGP-OLLAMA] Analysis completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: mappedData,
        message: 'Analyse RSGP complète effectuée avec succès'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RSGP-OLLAMA] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

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

    // Appeler Ollama via ollama-proxy
    const { data: ollamaResponse, error: ollamaError } = await supabaseClient.functions.invoke(
      'ollama-proxy',
      {
        body: {
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
        }
      }
    );

    if (ollamaError) {
      console.error('[RSGP-OLLAMA] Ollama error:', ollamaError);
      throw new Error(`Ollama error: ${ollamaError.message}`);
    }

    console.log('[RSGP-OLLAMA] Ollama response received');

    // Parser la réponse JSON
    let rsgpData;
    try {
      const responseText = ollamaResponse.content || ollamaResponse.message?.content || '';
      
      // Nettoyer la réponse (enlever markdown, etc.)
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      rsgpData = JSON.parse(cleanedResponse);
      console.log('[RSGP-OLLAMA] JSON parsed successfully');
    } catch (parseError) {
      console.error('[RSGP-OLLAMA] JSON parse error:', parseError);
      console.error('[RSGP-OLLAMA] Raw response:', ollamaResponse);
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
        rsgp_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);

    if (updateError) {
      console.error('[RSGP-OLLAMA] Update error:', updateError);
      throw new Error(`Failed to update analysis: ${updateError.message}`);
    }

    // Optionnel: Sauvegarder aussi dans la table rsgp_compliance pour historique
    const { error: rsgpInsertError } = await supabaseClient
      .from('rsgp_compliance')
      .insert({
        analysis_id: analysisId,
        user_id: analysis.user_id,
        ...mappedData
      });

    if (rsgpInsertError) {
      console.warn('[RSGP-OLLAMA] Failed to insert in rsgp_compliance table:', rsgpInsertError);
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

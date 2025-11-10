import React, { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Package, Barcode, Link, Loader2, Store, RefreshCw, Sparkles, Cloud } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Progress } from "./ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEnrichmentPipeline } from "@/hooks/useEnrichmentPipeline";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";

interface BatchAnalyzerProps {
  onAnalysisComplete: (results: any[]) => void;
}

interface ProviderStat {
  provider: string;
  count: number;
  successRate: number;
}

export const BatchAnalyzer = ({ onAnalysisComplete }: BatchAnalyzerProps) => {
  const [batchInput, setBatchInput] = useState("");
  const [inputType, setInputType] = useState<"name" | "barcode" | "url">("name");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProduct, setCurrentProduct] = useState("");
  const [currentProvider, setCurrentProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [autoExport, setAutoExport] = useState(false);
  const [autoAmazonEnrich, setAutoAmazonEnrich] = useState(true);
  const [autoAdvancedEnrich, setAutoAdvancedEnrich] = useState(false);
  const [autoOdooAttributes, setAutoOdooAttributes] = useState(true);
  const [autoCategories, setAutoCategories] = useState(false);
  const [autoImages, setAutoImages] = useState(false);
  const [autoShopping, setAutoShopping] = useState(false);
  const [autoVideo, setAutoVideo] = useState(false);
  const [exportPlatform, setExportPlatform] = useState<string>("odoo");
  const [failedProducts, setFailedProducts] = useState<Array<{ product: string; error: string }>>([]);
  const [providerStats, setProviderStats] = useState<ProviderStat[]>([]);
  const [enrichmentProgress, setEnrichmentProgress] = useState<Record<string, any>>({});
  const { runFullPipeline, isEnriching, currentStep } = useEnrichmentPipeline();

  const getPlaceholder = () => {
    switch (inputType) {
      case "name":
        return "iPhone 15 Pro\nSamsung Galaxy S24\nSony WH-1000XM5";
      case "barcode":
        return "1234567890123\n9876543210987\n5555555555555";
      case "url":
        return "https://amazon.com/product1\nhttps://amazon.com/product2\nhttps://amazon.com/product3";
    }
  };

  const analyzeBatch = async () => {
    const products = batchInput
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (products.length === 0) {
      toast.error("Veuillez entrer au moins un produit");
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setFailedProducts([]);
    const results = [];
    const providerMap: Record<string, { total: number; success: number }> = {};

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      setCurrentProduct(product);
      setProgress(((i + 1) / products.length) * 100);

      try {
        const { data, error } = await supabase.functions.invoke('product-analyzer', {
          body: { 
            productInput: product, 
            includeImages: true,
            preferred_model: selectedModel === 'auto' ? undefined : selectedModel
          }
        });

        if (error) {
          console.error('[BATCH] Product analyzer error:', { 
            status: error.status,
            message: error.message,
            product
          });

          if (error.status === 401) {
            toast.error("Session expirée, veuillez vous reconnecter");
            setIsAnalyzing(false);
            return;
          } else if (error.status === 402) {
            toast.warning(`Provider IA manque de crédits, tentative de fallback...`);
          } else if (error.status === 429) {
            toast.warning(`Limite de requêtes atteinte, ralentissement...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          throw error;
        }

        if (data.success) {
          // Track provider usage
          const provider = data._provider || data.usedProvider || 'unknown';
          const model = data._model || selectedModel;
          
          if (provider) {
            if (!providerMap[provider]) {
              providerMap[provider] = { total: 0, success: 0 };
            }
            providerMap[provider].total++;
            providerMap[provider].success++;
            setCurrentProvider(`${provider} - ${model}`);
          }
          
          // Validate analysis structure before saving
          if (!data.analysis || typeof data.analysis !== 'object') {
            console.error('❌ Invalid analysis structure received:', {
              product,
              hasAnalysis: !!data.analysis,
              analysisType: typeof data.analysis,
              analysisKeys: data.analysis ? Object.keys(data.analysis) : [],
              rawData: data
            });
            
            setFailedProducts(prev => [...prev, {
              product,
              error: 'Structure d\'analyse invalide'
            }]);
            
            results.push({
              product,
              error: 'Structure d\'analyse invalide - Aucune donnée valide retournée',
              success: false,
              provider,
              model
            });
            continue;
          }
          
          // Enhanced quality validation
          const isIncomplete = 
            data.analysis.parsing_error === true ||
            data.analysis._incomplete === true ||
            !data.analysis.seo?.score ||
            !data.analysis.pricing?.estimated_price ||
            !data.analysis.product_name;

          if (isIncomplete) {
            console.warn('⚠️ Analyse incomplète détectée:', {
              product,
              missing: data.analysis._missing_fields || [],
              hasParsingError: data.analysis.parsing_error,
              hasIncompleteFlag: data.analysis._incomplete
            });
            
            // Mark as partial success
            results.push({
              product,
              analysis: data.analysis,
              imageUrls: data.imageUrls || [],
              success: 'partial',
              warning: 'Analyse incomplète - certains détails manquent',
              provider,
              model
            });
            continue;
          }
          
          // Warn if missing essential fields
          if (!data.analysis.product_name) {
            console.warn('Missing product_name in analysis for:', product);
          }
          
          // 1️⃣ Save to database FIRST (without enrichments)
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const insertData: any = {
              user_id: user.id,
              product_url: product,
              analysis_result: data.analysis,
              image_urls: data.imageUrls || [],
              tags: data.analysis?.tags_categories?.suggested_tags || [],
              mapped_category_id: data.analysis?.tags_categories?.odoo_category_id,
              mapped_category_name: data.analysis?.tags_categories?.odoo_category_name,
              enrichment_status: {
                categories: 'not_started',
                images: 'not_started',
                shopping: 'not_started',
                specifications: 'not_started',
                technical_description: 'not_started',
                cost_analysis: 'not_started',
                rsgp_compliance: 'not_started',
                odoo_attributes: 'not_started',
                heygen: 'not_started'
              },
              amazon_enrichment_status: autoAmazonEnrich ? 'pending' : null,
              amazon_last_attempt: autoAmazonEnrich ? new Date().toISOString() : null,
            };

            const { data: insertedAnalysis, error: insertError } = await supabase
              .from('product_analyses')
              .insert(insertData)
              .select()
              .single();

            if (insertError) {
              console.error('Failed to save analysis:', insertError);
              throw insertError;
            }

            console.log('✅ Product saved to database with ID:', insertedAnalysis.id);

            // 2️⃣ Run enrichment pipeline with real analysisId
            let enrichmentResults: any = null;
            if (autoCategories || autoImages || autoShopping || autoAdvancedEnrich || autoOdooAttributes || autoVideo) {
              console.log('🚀 Starting enrichment pipeline for analysis:', insertedAnalysis.id);
              try {
                enrichmentResults = await runFullPipeline(
                  insertedAnalysis.id,
                  data.analysis,
                  {
                    includeCategories: autoCategories,
                    includeImages: autoImages,
                    includeShopping: autoShopping,
                    includeAdvanced: autoAdvancedEnrich,
                    includeOdoo: autoOdooAttributes,
                    includeVideo: autoVideo
                  }
                );
                console.log('✅ Enrichment pipeline completed:', enrichmentResults);

                // 3️⃣ Update analysis with enrichment results
                const { error: updateError } = await supabase
                  .from('product_analyses')
                  .update({
                    analysis_result: {
                      ...data.analysis,
                      enrichments: enrichmentResults
                    },
                    image_urls: enrichmentResults?.images?.urls || data.imageUrls || [],
                    mapped_category_id: enrichmentResults?.categories?.google?.id || data.analysis?.tags_categories?.odoo_category_id,
                    mapped_category_name: enrichmentResults?.categories?.google?.name || data.analysis?.tags_categories?.odoo_category_name,
                    enrichment_status: {
                      categories: enrichmentResults?.categories?.success ? 'completed' : (enrichmentResults?.categories ? 'failed' : 'not_started'),
                      images: enrichmentResults?.images?.success ? 'completed' : (enrichmentResults?.images ? 'failed' : 'not_started'),
                      shopping: enrichmentResults?.shopping?.success ? 'completed' : (enrichmentResults?.shopping ? 'failed' : 'not_started'),
                      specifications: enrichmentResults?.advanced?.specifications ? 'completed' : 'not_started',
                      technical_description: enrichmentResults?.advanced?.technical_description ? 'completed' : 'not_started',
                      cost_analysis: enrichmentResults?.advanced?.cost_analysis ? 'completed' : 'not_started',
                      rsgp_compliance: enrichmentResults?.advanced?.rsgp_compliance ? 'completed' : 'not_started',
                      odoo_attributes: enrichmentResults?.odoo?.success ? 'completed' : (enrichmentResults?.odoo ? 'failed' : 'not_started'),
                      heygen: enrichmentResults?.video?.success ? 'completed' : 'not_started'
                    }
                  })
                  .eq('id', insertedAnalysis.id);

                if (updateError) {
                  console.error('⚠️ Failed to update enrichments:', updateError);
                } else {
                  console.log('✅ Enrichments saved to database');
                }

              } catch (enrichError) {
                console.error('❌ Enrichment pipeline error:', enrichError);
                toast.error(`Enrichissements échoués pour ${product}`);
              }
            }

            // Auto-enrichissement Amazon si activé
            if (autoAmazonEnrich && insertedAnalysis?.id) {
              const ean = data.analysis?.barcode || data.analysis?.ean || data.analysis?.gtin;
              if (ean) {
                console.log('[BATCH] Triggering Amazon enrichment for:', product);
                // Fire and forget - ne pas attendre la réponse
                supabase.functions.invoke('amazon-product-enrichment', {
                  body: { 
                    analysis_id: insertedAnalysis.id,
                    ean: ean
                  }
                }).catch(err => console.error('Amazon enrichment error:', err));
              }
            }

            // ✅ Phase 3: Enrichissements avancés si activés
            if (autoAdvancedEnrich && insertedAnalysis?.id) {
              console.log('[BATCH] 🚀 Triggering advanced enrichments for:', product);
              
              try {
                const { data: enrichData, error: enrichError } = await supabase.functions.invoke('enrich-all', {
                  body: { 
                    analysisId: insertedAnalysis.id,
                    productData: data.analysis,
                    purchasePrice: null,
                    preferred_model: selectedModel !== 'auto' ? selectedModel : undefined
                  }
                });
                
                if (enrichError) {
                  console.error('[BATCH] Advanced enrichment error:', {
                    status: enrichError.status,
                    message: enrichError.message,
                    product
                  });
                  
                  toast.error(`Enrichissements avancés échoués pour ${product}`);
                  
                  // Fallback: call each function individually
                  console.log('[BATCH] Falling back to individual enrichments');
                  await Promise.allSettled([
                    supabase.functions.invoke('enrich-specifications', { 
                      body: { analysisId: insertedAnalysis.id, productData: data.analysis, preferred_model: selectedModel !== 'auto' ? selectedModel : undefined } 
                    }),
                    supabase.functions.invoke('enrich-technical-description', { 
                      body: { analysisId: insertedAnalysis.id, productData: data.analysis, preferred_model: selectedModel !== 'auto' ? selectedModel : undefined } 
                    }),
                    supabase.functions.invoke('enrich-cost-analysis', { 
                      body: { analysisId: insertedAnalysis.id, productData: data.analysis, preferred_model: selectedModel !== 'auto' ? selectedModel : undefined } 
                    })
                  ]);
                  
                } else if (enrichData?.success) {
                  console.log('[BATCH] ✅ Advanced enrichments summary:', enrichData);
                  toast.success(`✨ Enrichissements avancés terminés pour ${product}`);
                  
                  setEnrichmentProgress(prev => ({
                    ...prev,
                    [product]: enrichData.summary
                  }));
                } else {
                  console.warn('[BATCH] ⚠️ Partial enrichment success:', enrichData);
                  toast.warning(`Enrichissements partiels pour ${product}`);
                  
                  if (enrichData?.summary) {
                    setEnrichmentProgress(prev => ({
                      ...prev,
                      [product]: enrichData.summary
                    }));
                  }
                }
              } catch (err) {
                console.error('[BATCH] All enrichment methods failed:', err);
                toast.error(`Erreur lors des enrichissements pour ${product}`);
              }
            }

            // Phase 4: Enrichissement des attributs Odoo si activé
            if (autoOdooAttributes && insertedAnalysis?.id) {
              console.log('[BATCH] 📋 Triggering Odoo attributes enrichment for:', product);
              
              try {
                const { data: odooData, error: odooError } = await supabase.functions.invoke('enrich-odoo-attributes', {
                  body: { 
                    analysisId: insertedAnalysis.id,
                    provider: 'lovable',
                    webSearchEnabled: true
                  }
                });
                
                if (odooError) {
                  console.error('[BATCH] Odoo attributes enrichment error:', {
                    status: odooError.status,
                    message: odooError.message,
                    product
                  });
                  
                  toast.error(`Enrichissement attributs Odoo échoué pour ${product}`);
                } else if (odooData?.success) {
                  console.log('[BATCH] ✅ Odoo attributes enriched:', odooData);
                  toast.success(`📋 ${odooData.stats?.valid || 0} attributs Odoo déterminés pour ${product}`);
                }
              } catch (err) {
                console.error('[BATCH] Odoo attributes enrichment failed:', err);
                toast.warning(`Impossible d'enrichir les attributs Odoo pour ${product}`);
              }
            }

            // 4️⃣ Add enrichments to result displayed
            const analysisResult = typeof insertedAnalysis.analysis_result === 'object' && insertedAnalysis.analysis_result !== null
              ? insertedAnalysis.analysis_result
              : {};
            
            results.push({
              product,
              analysis: {
                ...insertedAnalysis,
                analysis_result: {
                  ...analysisResult,
                  enrichments: enrichmentResults
                }
              },
              enrichments: enrichmentResults,
              imageUrls: enrichmentResults?.images?.urls || data.imageUrls || [],
              success: true,
              analysisId: insertedAnalysis.id,
              provider,
              model
            });
          }
        } else {
          results.push({
            product,
            error: data.error || 'Erreur d\'analyse',
            success: false
          });
        }
      } catch (error) {
        console.error('Error analyzing product:', error);
        results.push({
          product,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          success: false
        });
      }
    }

    // Calculate provider stats
    const stats: ProviderStat[] = Object.entries(providerMap).map(([provider, data]) => ({
      provider,
      count: data.total,
      successRate: (data.success / data.total) * 100
    }));
    setProviderStats(stats);

    setIsAnalyzing(false);
    setCurrentProduct("");
    setCurrentProvider("");
    
    const successCount = results.filter(r => r.success).length;
    
    // Show provider statistics
    const providerSummary = stats
      .map(s => `${s.provider}: ${s.count}`)
      .join(', ');
    
    toast.success(`Analyse terminée: ${successCount}/${products.length} produits analysés avec succès${providerSummary ? ` (Providers: ${providerSummary})` : ''}`);
    
    // Auto-export to selected platform if enabled
    if (autoExport && successCount > 0) {
      const analysisIds = results
        .filter(r => r.success && r.analysisId)
        .map(r => r.analysisId);

      if (analysisIds.length > 0) {
        try {
          // Get current session explicitly
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !sessionData.session) {
            toast.error("Session expirée, veuillez vous reconnecter");
            return;
          }

          const platformDisplayNames: Record<string, string> = {
            odoo: 'Odoo',
            shopify: 'Shopify',
            woocommerce: 'WooCommerce',
            prestashop: 'PrestaShop',
            magento: 'Magento',
            salesforce: 'Salesforce',
            sap: 'SAP',
            uber_eats: 'Uber Eats',
            deliveroo: 'Deliveroo',
            just_eat: 'Just Eat',
            windev: 'WinDev'
          };
          
          const platformName = platformDisplayNames[exportPlatform] || exportPlatform;
          toast.info(`Export vers ${platformName} en cours...`);
          
          const { data: exportData, error: exportError } = await supabase.functions.invoke(`export-to-${exportPlatform}`, {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`
            },
            body: { analysisIds, analysis_ids: analysisIds }
          });

          if (exportError) throw exportError;

          // Show detailed success message with created/updated counts
          const { success_count, created_count = 0, updated_count = 0, error_count = 0 } = exportData || {};
          const exportSuccess = success_count || exportData?.results?.filter((r: any) => r.success).length || 0;
          
          if (exportSuccess > 0) {
            let message = `${exportSuccess} produit(s) exporté(s)`;
            if (created_count > 0 || updated_count > 0) {
              message += ` (${created_count} créé(s), ${updated_count} mis à jour)`;
            }
            toast.success(`${platformName}: ${message}`);
          }
          
          if (error_count > 0) {
            toast.warning(`${error_count} erreur(s) lors de l'export vers ${platformName}`);
          }
        } catch (exportError) {
          console.error('Export error:', exportError);
          toast.error(`Erreur lors de l'export`);
        }
      }
    }
    
    // Déclencher auto-surveillance marché pour chaque produit analysé
    for (const result of results) {
      try {
        await supabase.functions.invoke('auto-market-intelligence', {
          body: {
            analysisId: result.id,
            productName: result.analysis?.product_name || result.productInput
          }
        });
      } catch (marketError) {
        console.error('Erreur auto-surveillance:', marketError);
      }
    }
    
    onAnalysisComplete(results);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyse en Lot</CardTitle>
        <CardDescription>
          Analysez plusieurs produits à la fois en entrant un produit par ligne
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="model-select">Modèle IA</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger id="model-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">🔄 Auto (Fallback automatique)</SelectItem>
              <SelectItem value="deepseek-v3.1:671b-cloud">
                <Cloud className="w-4 h-4 inline mr-1" />
                Ollama Cloud: DeepSeek V3.1
              </SelectItem>
              <SelectItem value="gpt-oss:120b-cloud">
                <Cloud className="w-4 h-4 inline mr-1" />
                Ollama Cloud: GPT-OSS 120B
              </SelectItem>
              <SelectItem value="kimi-k2:1t-cloud">
                <Cloud className="w-4 h-4 inline mr-1" />
                Ollama Cloud: Kimi K2 1T
              </SelectItem>
              <SelectItem value="google/gemini-2.5-flash">
                <Sparkles className="w-4 h-4 inline mr-1" />
                Lovable AI: Gemini Flash
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={inputType} onValueChange={(v) => setInputType(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="name">
              <Package className="w-4 h-4 mr-2" />
              Nom
            </TabsTrigger>
            <TabsTrigger value="barcode">
              <Barcode className="w-4 h-4 mr-2" />
              Code-barres
            </TabsTrigger>
            <TabsTrigger value="url">
              <Link className="w-4 h-4 mr-2" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value={inputType} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>⚙️ Configuration des Enrichissements Automatiques</CardTitle>
                <CardDescription>
                  Choisissez quels enrichissements doivent être exécutés automatiquement lors de l'analyse
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Catégorisation */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="font-semibold">🏷️ Catégorisation IA</Label>
                      <p className="text-sm text-muted-foreground">
                        Google & Amazon taxonomie
                      </p>
                    </div>
                    <Switch
                      checked={autoCategories}
                      onCheckedChange={setAutoCategories}
                      disabled={isAnalyzing}
                    />
                  </div>
                  
                  {/* Images */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="font-semibold">🖼️ Recherche d'Images</Label>
                      <p className="text-sm text-muted-foreground">
                        Images haute qualité du produit
                      </p>
                    </div>
                    <Switch
                      checked={autoImages}
                      onCheckedChange={setAutoImages}
                      disabled={isAnalyzing}
                    />
                  </div>
                  
                  {/* Google Shopping */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="font-semibold">🛒 Google Shopping</Label>
                      <p className="text-sm text-muted-foreground">
                        Analyse concurrentielle
                      </p>
                    </div>
                    <Switch
                      checked={autoShopping}
                      onCheckedChange={setAutoShopping}
                      disabled={isAnalyzing}
                    />
                  </div>
                  
                  {/* Amazon */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="font-semibold">📦 Amazon</Label>
                      <p className="text-sm text-muted-foreground">
                        Prix et détails Amazon
                      </p>
                    </div>
                    <Switch
                      checked={autoAmazonEnrich}
                      onCheckedChange={setAutoAmazonEnrich}
                      disabled={isAnalyzing}
                    />
                  </div>
                  
                  {/* Enrichissements avancés */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="font-semibold">✨ Enrichissements Avancés</Label>
                      <p className="text-sm text-muted-foreground">
                        Specs, Description, Coûts, RGPD
                      </p>
                    </div>
                    <Switch
                      checked={autoAdvancedEnrich}
                      onCheckedChange={setAutoAdvancedEnrich}
                      disabled={isAnalyzing}
                    />
                  </div>
                  
                  {/* Attributs Odoo */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="font-semibold">📋 Attributs Odoo</Label>
                      <p className="text-sm text-muted-foreground">
                        Catégorie auto-détectée
                      </p>
                    </div>
                    <Switch
                      checked={autoOdooAttributes}
                      onCheckedChange={setAutoOdooAttributes}
                      disabled={isAnalyzing}
                    />
                  </div>
                  
                  {/* Vidéo HeyGen */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="font-semibold">🎥 Vidéo HeyGen</Label>
                      <p className="text-sm text-muted-foreground">
                        Génération vidéo (optionnel)
                      </p>
                    </div>
                    <Switch
                      checked={autoVideo}
                      onCheckedChange={setAutoVideo}
                      disabled={isAnalyzing}
                    />
                  </div>
                </div>
                
                {/* Résumé des enrichissements sélectionnés */}
                {(autoCategories || autoImages || autoShopping || autoAmazonEnrich || autoAdvancedEnrich || autoOdooAttributes || autoVideo) && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-semibold mb-2">Enrichissements activés :</p>
                    <div className="flex flex-wrap gap-2">
                      {autoCategories && <Badge>🏷️ Catégorisation</Badge>}
                      {autoImages && <Badge>🖼️ Images</Badge>}
                      {autoShopping && <Badge>🛒 Shopping</Badge>}
                      {autoAmazonEnrich && <Badge>📦 Amazon</Badge>}
                      {autoAdvancedEnrich && <Badge>✨ Avancés</Badge>}
                      {autoOdooAttributes && <Badge>📋 Odoo</Badge>}
                      {autoVideo && <Badge>🎥 Vidéo</Badge>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3 mb-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-export"
                checked={autoExport}
                onCheckedChange={setAutoExport}
                disabled={isAnalyzing}
              />
              <Label htmlFor="auto-export" className="cursor-pointer">
                Export automatique après l'analyse
              </Label>
            </div>
              
              {autoExport && (
                <div className="space-y-2 ml-8">
                  <Label htmlFor="export-platform" className="text-sm">
                    <Store className="w-3 h-3 inline mr-1" />
                    Plateforme de destination
                  </Label>
                  <Select value={exportPlatform} onValueChange={setExportPlatform}>
                    <SelectTrigger id="export-platform" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="odoo">📦 Odoo</SelectItem>
                      <SelectItem value="shopify">🏪 Shopify</SelectItem>
                      <SelectItem value="woocommerce">🌐 WooCommerce</SelectItem>
                      <SelectItem value="prestashop">🛒 PrestaShop</SelectItem>
                      <SelectItem value="magento">📦 Magento</SelectItem>
                      <SelectItem value="salesforce">☁️ Salesforce</SelectItem>
                      <SelectItem value="sap">🏢 SAP</SelectItem>
                      <SelectItem value="uber_eats">🍔 Uber Eats</SelectItem>
                      <SelectItem value="deliveroo">🚚 Deliveroo</SelectItem>
                      <SelectItem value="just_eat">📱 Just Eat</SelectItem>
                      <SelectItem value="windev">💻 WinDev</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Textarea
              placeholder={getPlaceholder()}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              rows={10}
              disabled={isAnalyzing}
            />

            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{currentStep || 'Analyse en cours...'}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
                {currentProduct && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Produit actuel: {currentProduct}
                    </p>
                    {currentProvider && (
                      <Badge variant="outline" className="text-xs">
                        {currentProvider}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}

            {providerStats.length > 0 && !isAnalyzing && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Statistiques Providers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {providerStats.map((stat) => (
                      <div key={stat.provider} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {stat.provider}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {stat.count} produit{stat.count > 1 ? 's' : ''}
                          </span>
                        </div>
                        <Badge variant={stat.successRate === 100 ? 'default' : 'secondary'}>
                          {stat.successRate.toFixed(0)}% réussite
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {failedProducts.length > 0 && !isAnalyzing && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm font-medium mb-2">Échecs ({failedProducts.length}):</p>
                <div className="space-y-1">
                  {failedProducts.map((fp, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      • {fp.product}: {fp.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={analyzeBatch}
              disabled={isAnalyzing || isEnriching || !batchInput.trim()}
              className="w-full"
            >
              {isAnalyzing || isEnriching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {currentStep || 'Analyse en cours...'}
                </>
              ) : (
                "Analyser tous les produits"
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

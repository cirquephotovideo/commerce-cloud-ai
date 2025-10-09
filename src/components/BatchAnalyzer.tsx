import React, { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Package, Barcode, Link, Loader2, Store } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Progress } from "./ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

interface BatchAnalyzerProps {
  onAnalysisComplete: (results: any[]) => void;
}

export const BatchAnalyzer = ({ onAnalysisComplete }: BatchAnalyzerProps) => {
  const [batchInput, setBatchInput] = useState("");
  const [inputType, setInputType] = useState<"name" | "barcode" | "url">("name");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProduct, setCurrentProduct] = useState("");
  const [autoExport, setAutoExport] = useState(false);
  const [autoAmazonEnrich, setAutoAmazonEnrich] = useState(true);
  const [exportPlatform, setExportPlatform] = useState<string>("odoo");

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
    const results = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      setCurrentProduct(product);
      setProgress(((i + 1) / products.length) * 100);

      try {
        const { data, error } = await supabase.functions.invoke('product-analyzer', {
          body: { productInput: product, includeImages: true }
        });

        if (error) throw error;

        if (data.success) {
          // Validate analysis structure before saving
          if (!data.analysis || typeof data.analysis !== 'object') {
            console.error('❌ Invalid analysis structure received:', {
              product,
              hasAnalysis: !!data.analysis,
              analysisType: typeof data.analysis,
              analysisKeys: data.analysis ? Object.keys(data.analysis) : [],
              rawData: data
            });
            results.push({
              product,
              error: 'Structure d\'analyse invalide - Aucune donnée valide retournée',
              success: false
            });
            continue;
          }
          
          // Warn if missing essential fields
          if (!data.analysis.product_name) {
            console.warn('Missing product_name in analysis for:', product);
          }
          
          // Auto-save to database with image URLs and category mapping
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const insertData: any = {
              user_id: user.id,
              product_url: product,
              analysis_result: data.analysis,
              image_urls: data.imageUrls || [],
              tags: data.analysis?.tags_categories?.suggested_tags || [],
              amazon_enrichment_status: autoAmazonEnrich ? 'pending' : null,
              amazon_last_attempt: autoAmazonEnrich ? new Date().toISOString() : null,
            };

            // Add category mapping if available
            if (data.analysis?.tags_categories?.odoo_category_id) {
              insertData.mapped_category_id = String(data.analysis.tags_categories.odoo_category_id);
              insertData.mapped_category_name = data.analysis.tags_categories.odoo_category_name;
            }

            // Store raw_analysis for debugging if present
            if (data.analysis.raw_analysis) {
              console.log('Partial analysis detected, storing raw data for:', product);
            }

            const { data: insertedAnalysis } = await supabase
              .from('product_analyses')
              .insert(insertData)
              .select()
              .single();

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

            results.push({
              product,
              analysis: data.analysis,
              imageUrls: data.imageUrls || [],
              success: true,
              analysisId: insertedAnalysis?.id
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

    setIsAnalyzing(false);
    setCurrentProduct("");
    
    const successCount = results.filter(r => r.success).length;
    toast.success(`Analyse terminée: ${successCount}/${products.length} produits analysés avec succès`);
    
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
          toast.error(`Erreur lors de l'export vers ${platformDisplayNames[exportPlatform] || exportPlatform}`);
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
            <div className="space-y-3 mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-amazon"
                  checked={autoAmazonEnrich}
                  onCheckedChange={setAutoAmazonEnrich}
                  disabled={isAnalyzing}
                />
                <Label htmlFor="auto-amazon" className="cursor-pointer">
                  🔄 Auto-enrichissement Amazon (recommandé)
                </Label>
              </div>
              
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
                  <span>Analyse en cours...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
                {currentProduct && (
                  <p className="text-sm text-muted-foreground">
                    Produit actuel: {currentProduct}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={analyzeBatch}
              disabled={isAnalyzing || !batchInput.trim()}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyse en cours...
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

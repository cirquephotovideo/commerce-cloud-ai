import React, { useState } from "react";
import { Header } from "@/components/Header";
import { BatchAnalyzer as BatchAnalyzerComponent } from "@/components/BatchAnalyzer";
import { DetailedBatchResults } from "@/components/DetailedBatchResults";
import { OdooSettings } from "@/components/OdooSettings";
import { OdooFieldMappings } from "@/components/OdooFieldMappings";
import { PlatformSettings } from "@/components/PlatformSettings";
import { PlatformFieldMappings } from "@/components/PlatformFieldMappings";
import { PricingRules } from "@/components/PricingRules";
import { TechnicalAnalysis } from "@/components/advanced/TechnicalAnalysis";
import { RiskAnalysis } from "@/components/advanced/RiskAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const getPlatformName = (platform: string): string => {
  const platformNames: { [key: string]: string } = {
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
  return platformNames[platform] || platform;
};

const BatchAnalyzer = () => {
  const [results, setResults] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [exportPlatform, setExportPlatform] = useState<string>('odoo');

  const handleAnalysisComplete = (newResults: any[]) => {
    setResults(newResults);
  };

  const handleSyncCategories = async () => {
    setIsSyncing(true);
    try {
      const platformName = getPlatformName(exportPlatform);
      toast.info(`Synchronisation des catégories ${platformName}...`);
      
      const functionName = exportPlatform === 'odoo' ? 'sync-odoo-categories' : `sync-${exportPlatform}-categories`;
      const { data, error } = await supabase.functions.invoke(functionName);
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`${data.categories_synced} catégories synchronisées avec succès`);
      } else {
        toast.error(data.error || "Erreur lors de la synchronisation");
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la synchronisation"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async (selectedProducts: any[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const productUrls = selectedProducts.map(p => p.product);
      const { data: analyses, error: fetchError } = await supabase
        .from('product_analyses')
        .select('id')
        .in('product_url', productUrls)
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      const analysisIds = analyses?.map(a => a.id) || [];

      if (analysisIds.length === 0) {
        toast.error("Aucune analyse trouvée");
        return;
      }

      const platformName = getPlatformName(exportPlatform);

      toast.info(`Export vers ${platformName} en cours...`);

      const functionName = exportPlatform === 'odoo' ? 'export-to-odoo' : `export-to-${exportPlatform}`;
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { analysisIds }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(
          `Export réussi: ${data.success_count} produits créés${
            data.error_count > 0 ? `, ${data.error_count} erreurs` : ''
          }`
        );
      } else {
        toast.error(data.error || "Erreur lors de l'export");
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'export"
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Analyse en Lot</h1>
          <p className="text-muted-foreground">
            Analysez plusieurs produits et exportez-les automatiquement vers {getPlatformName(exportPlatform)}
          </p>
        </div>

        <Tabs defaultValue="analyze" className="space-y-6">
          <TabsList>
            <TabsTrigger value="analyze">Analyser</TabsTrigger>
            <TabsTrigger value="technical">Analyses Techniques</TabsTrigger>
            <TabsTrigger value="risk">Gestion Risques</TabsTrigger>
            <TabsTrigger value="settings">Configuration {getPlatformName(exportPlatform)}</TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="space-y-6">
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Export Platform</label>
              <Select value={exportPlatform} onValueChange={setExportPlatform}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="odoo">Odoo</SelectItem>
                  <SelectItem value="shopify">🏪 Shopify</SelectItem>
                  <SelectItem value="woocommerce">🌐 WooCommerce</SelectItem>
                  <SelectItem value="prestashop">🛒 PrestaShop</SelectItem>
                  <SelectItem value="magento">📦 Magento</SelectItem>
                  <SelectItem value="salesforce">☁️ Salesforce</SelectItem>
                  <SelectItem value="sap">🏢 SAP</SelectItem>
                  <SelectItem value="uber_eats">🍔 Uber Eats</SelectItem>
                  <SelectItem value="deliveroo">🚴 Deliveroo</SelectItem>
                  <SelectItem value="just_eat">🍕 Just Eat</SelectItem>
                  <SelectItem value="windev">💻 WinDev</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <BatchAnalyzerComponent onAnalysisComplete={handleAnalysisComplete} />
            {results.length > 0 && (
              <DetailedBatchResults results={results} onExport={handleExport} />
            )}
          </TabsContent>

          <TabsContent value="technical" className="space-y-6">
            <TechnicalAnalysis />
          </TabsContent>

          <TabsContent value="risk" className="space-y-6">
            <RiskAnalysis />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Tabs defaultValue="odoo" className="space-y-4">
              <TabsList>
                <TabsTrigger value="odoo">Odoo</TabsTrigger>
                <TabsTrigger value="platforms">Other Platforms</TabsTrigger>
              </TabsList>
              
              <TabsContent value="odoo" className="space-y-6">
                <div className="flex justify-end mb-4">
                  <Button
                    variant="outline"
                    onClick={handleSyncCategories}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Synchronisation...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Synchroniser les catégories {getPlatformName(exportPlatform)}
                      </>
                    )}
                  </Button>
                </div>
                <OdooSettings />
                <OdooFieldMappings />
              </TabsContent>
              
              <TabsContent value="platforms" className="space-y-6">
                <PlatformSettings />
                <PlatformFieldMappings />
                <PricingRules />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default BatchAnalyzer;

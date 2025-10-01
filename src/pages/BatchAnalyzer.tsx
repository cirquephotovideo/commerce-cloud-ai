import React, { useState } from "react";
import { Header } from "@/components/Header";
import { BatchAnalyzer as BatchAnalyzerComponent } from "@/components/BatchAnalyzer";
import { DetailedBatchResults } from "@/components/DetailedBatchResults";
import { OdooSettings } from "@/components/OdooSettings";
import { OdooFieldMappings } from "@/components/OdooFieldMappings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const BatchAnalyzer = () => {
  const [results, setResults] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleAnalysisComplete = (newResults: any[]) => {
    setResults(newResults);
  };

  const handleSyncCategories = async () => {
    setIsSyncing(true);
    try {
      toast.info("Synchronisation des catégories Odoo...");
      
      const { data, error } = await supabase.functions.invoke('sync-odoo-categories');
      
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
      // Get analysis IDs from database
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

      toast.info("Export vers Odoo en cours...");

      const { data, error } = await supabase.functions.invoke('export-to-odoo', {
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
        error instanceof Error ? error.message : "Erreur lors de l'export vers Odoo"
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
            Analysez plusieurs produits et exportez-les automatiquement vers Odoo
          </p>
        </div>

        <Tabs defaultValue="analyze" className="space-y-6">
          <TabsList>
            <TabsTrigger value="analyze">Analyser</TabsTrigger>
            <TabsTrigger value="settings">Configuration Odoo</TabsTrigger>
          </TabsList>

          <TabsContent value="analyze" className="space-y-6">
            <BatchAnalyzerComponent onAnalysisComplete={handleAnalysisComplete} />
            {results.length > 0 && (
              <DetailedBatchResults results={results} onExport={handleExport} />
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
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
                    Synchroniser les catégories Odoo
                  </>
                )}
              </Button>
            </div>
              <OdooSettings />
              <OdooFieldMappings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default BatchAnalyzer;

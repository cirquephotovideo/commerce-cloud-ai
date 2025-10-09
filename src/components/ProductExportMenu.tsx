import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Download, Loader2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { ExportHistoryDialog } from "@/components/ExportHistoryDialog";

interface ProductExportMenuProps {
  analysisId: string;
  productName: string;
  exportedPlatforms?: string[];
}

const platforms = [
  { id: 'odoo', name: 'Odoo', emoji: '📦' },
  { id: 'shopify', name: 'Shopify', emoji: '🛍️' },
  { id: 'woocommerce', name: 'WooCommerce', emoji: '🛒' },
  { id: 'prestashop', name: 'PrestaShop', emoji: '🏪' },
  { id: 'magento', name: 'Magento', emoji: '📦' },
  { id: 'salesforce', name: 'Salesforce', emoji: '☁️' },
  { id: 'sap', name: 'SAP', emoji: '🏢' },
  { id: 'uber_eats', name: 'Uber Eats', emoji: '🍔' },
  { id: 'deliveroo', name: 'Deliveroo', emoji: '🚴' },
  { id: 'just_eat', name: 'Just Eat', emoji: '🍕' },
  { id: 'windev', name: 'WinDev', emoji: '💻' },
];

export const ProductExportMenu = ({ analysisId, productName, exportedPlatforms = [] }: ProductExportMenuProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Récupérer les plateformes configurées
  const { data: configuredPlatforms } = useQuery({
    queryKey: ['configured-platforms'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_configurations')
        .select('platform_type, is_active')
        .eq('is_active', true);
      
      return data?.map(p => p.platform_type) || [];
    },
  });

  const availablePlatforms = platforms.filter(p => 
    configuredPlatforms?.includes(p.id)
  );

  const handleExport = async (platformId: string, platformName: string) => {
    setIsExporting(true);
    try {
      toast.info(`Export vers ${platformName} en cours...`);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await supabase.functions.invoke('export-single-product', {
        body: {
          analysis_id: analysisId,
          platform: platformId,
        }
      });

      if (error) throw error;

      // Logger l'export dans l'historique
      await supabase.from('export_history').insert({
        analysis_id: analysisId,
        user_id: user.id,
        platform_type: platformId,
        status: data.success ? 'success' : 'failed',
        error_message: data.success ? null : data.error,
        exported_data: data.result,
      });

      // Mettre à jour les plateformes exportées
      const { data: analysisData } = await supabase
        .from('product_analyses')
        .select('exported_to_platforms')
        .eq('id', analysisId)
        .single();

      const currentPlatforms = (analysisData?.exported_to_platforms as string[]) || [];
      if (!currentPlatforms.includes(platformId)) {
        await supabase
          .from('product_analyses')
          .update({ exported_to_platforms: [...currentPlatforms, platformId] })
          .eq('id', analysisId);
      }

      if (data.success) {
        toast.success(`${productName} exporté vers ${platformName} !`);
      } else {
        toast.error(`Échec de l'export vers ${platformName}`);
      }
    } catch (error) {
      console.error(`Export error:`, error);
      toast.error("Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Exporter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Plateformes configurées</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availablePlatforms.length > 0 ? (
              availablePlatforms.map((platform) => {
                const isExported = Array.isArray(exportedPlatforms) && exportedPlatforms.includes(platform.id);
                
                return (
                  <DropdownMenuItem
                    key={platform.id}
                    onClick={() => handleExport(platform.id, platform.name)}
                    disabled={isExporting}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <span className="mr-2">{platform.emoji}</span>
                      {platform.name}
                    </div>
                    
                    {isExported && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        ✓ Exporté
                      </Badge>
                    )}
                  </DropdownMenuItem>
                );
              })
            ) : (
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                Aucune plateforme configurée
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(true)}
        >
          <History className="w-4 h-4" />
        </Button>
      </div>

      <ExportHistoryDialog 
        open={showHistory}
        onOpenChange={setShowHistory}
        analysisId={analysisId}
      />
    </>
  );
};
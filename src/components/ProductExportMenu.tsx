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
import { Download, Loader2 } from "lucide-react";

interface ProductExportMenuProps {
  analysisId: string;
  productName: string;
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

export const ProductExportMenu = ({ analysisId, productName }: ProductExportMenuProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (platformId: string, platformName: string) => {
    setIsExporting(true);
    try {
      toast.info(`Export vers ${platformName} en cours...`);

      const { data, error } = await supabase.functions.invoke('export-single-product', {
        body: {
          analysis_id: analysisId,
          platform: platformId,
        }
      });

      if (error) throw error;

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
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Choisir une plateforme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {platforms.map((platform) => (
          <DropdownMenuItem
            key={platform.id}
            onClick={() => handleExport(platform.id, platform.name)}
            disabled={isExporting}
          >
            <span className="mr-2">{platform.emoji}</span>
            {platform.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
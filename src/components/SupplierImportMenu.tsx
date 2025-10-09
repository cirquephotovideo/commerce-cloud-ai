import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SupplierImportMenuProps {
  supplierId?: string;
  onImportComplete?: () => void;
}

// Mapping icônes (identique à ProductExportMenu)
const platformIcons: Record<string, string> = {
  odoo: "🟣",
  shopify: "🟢",
  prestashop: "🔵",
  woocommerce: "🟣",
  magento: "🟠",
  salesforce: "💙",
  sap: "💼",
  uber_eats: "🍔",
  deliveroo: "🍽️",
  just_eat: "🍕",
  windev: "💻",
};

const platformLabels: Record<string, string> = {
  odoo: "Odoo",
  shopify: "Shopify",
  prestashop: "PrestaShop",
  woocommerce: "WooCommerce",
  magento: "Magento",
  salesforce: "Salesforce",
  sap: "SAP",
  uber_eats: "Uber Eats",
  deliveroo: "Deliveroo",
  just_eat: "Just Eat",
  windev: "WinDev",
};

export const SupplierImportMenu = ({ 
  supplierId, 
  onImportComplete 
}: SupplierImportMenuProps) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importingPlatform, setImportingPlatform] = useState<string | null>(null);
  const { toast } = useToast();

  // Récupérer les plateformes avec support import
  const { data: platforms, isLoading, error } = useQuery({
    queryKey: ['import-platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_configurations')
        .select('platform_type, is_active, supports_import')
        .eq('is_active', true)
        .eq('supports_import', true);

      if (error) {
        console.error('Error fetching platforms:', error);
        throw error;
      }
      
      // Grouper par plateforme (peut avoir plusieurs configs)
      const uniquePlatforms = Array.from(
        new Set(data?.map(p => p.platform_type) || [])
      );
      
      console.log('✅ Plateformes disponibles pour import:', uniquePlatforms);
      
      return uniquePlatforms;
    },
  });

  const handleImport = async (platform: string) => {
    setIsImporting(true);
    setImportingPlatform(platform);

    try {
      const { data, error } = await supabase.functions.invoke('import-from-platform', {
        body: {
          platform,
          supplier_id: supplierId,
        },
      });

      if (error) throw error;

      toast({
        title: "✅ Import réussi",
        description: `${data.imported} produits importés (${data.matched} matchés, ${data.new} nouveaux)`,
      });

      onImportComplete?.();

    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "❌ Erreur d'import",
        description: error.message || "Une erreur s'est produite lors de l'import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportingPlatform(null);
    }
  };

  if (isLoading) {
    return (
      <Button disabled size="sm" variant="outline">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement...
      </Button>
    );
  }

  // Gérer l'erreur
  if (error) {
    return (
      <Button disabled size="sm" variant="destructive">
        <Upload className="mr-2 h-4 w-4" />
        Erreur chargement
      </Button>
    );
  }

  // Pas de plateformes configurées
  if (!platforms || platforms.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button disabled size="sm" variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Importer depuis
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Aucune plateforme configurée pour l'import</p>
            <p className="text-xs text-muted-foreground">
              Configurez Odoo, Shopify, etc. dans Paramètres
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          size="sm" 
          variant="outline"
          disabled={isImporting}
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Import en cours...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Importer depuis
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {platforms.map((platform) => (
          <DropdownMenuItem
            key={platform}
            onClick={() => handleImport(platform)}
            disabled={isImporting}
            className="cursor-pointer"
          >
            <span className="mr-2 text-lg">{platformIcons[platform]}</span>
            <span>{platformLabels[platform]}</span>
            {importingPlatform === platform && (
              <Loader2 className="ml-auto h-4 w-4 animate-spin" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          Configurez vos plateformes dans Paramètres
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

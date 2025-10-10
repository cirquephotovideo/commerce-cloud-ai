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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, Settings, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ImportProgressDialog } from "@/components/ImportProgressDialog";

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
  const [showOptions, setShowOptions] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  
  // Options d'import
  const [importType, setImportType] = useState<'full' | 'incremental'>('full');
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [matchByEan, setMatchByEan] = useState(true);
  
  // Progress tracking
  const [importProgress, setImportProgress] = useState({
    total: 0,
    processed: 0,
    success: 0,
    skipped: 0,
    errors: 0,
    current_operation: '',
  });

  const { toast } = useToast();

  // Récupérer toutes les plateformes actives (pas de vérification supports_import)
  const { data: platforms, isLoading, error } = useQuery({
    queryKey: ['import-platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_configurations')
        .select('platform_type, is_active')
        .eq('is_active', true);

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

  const openImportOptions = (platform: string) => {
    setSelectedPlatform(platform);
    setShowOptions(true);
  };

  const handleImportWithOptions = async () => {
    setShowOptions(false);
    setIsImporting(true);
    setImportingPlatform(selectedPlatform);

    // Initialiser le tracking
    setImportProgress({
      total: 100,
      processed: 0,
      success: 0,
      skipped: 0,
      errors: 0,
      current_operation: 'Connexion à la plateforme...',
    });

    try {
      const { data, error } = await supabase.functions.invoke('import-from-platform', {
        body: {
          platform: selectedPlatform,
          supplier_id: supplierId,
          options: {
            import_type: importType,
            auto_enrich: autoEnrich,
            match_by_ean: matchByEan,
          },
        },
      });

      if (error) throw error;

      // Mettre à jour le progress final
      setImportProgress(prev => ({
        ...prev,
        processed: prev.total,
        current_operation: 'Import terminé',
      }));

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
    <>
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
              onClick={() => openImportOptions(platform)}
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

      {/* Dialog Options d'Import */}
      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Options d'Import - {platformLabels[selectedPlatform]}</DialogTitle>
            <DialogDescription>
              Configurez les options d'importation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Type d'import */}
            <div className="space-y-2">
              <Label>Type d'import</Label>
              <RadioGroup value={importType} onValueChange={(v) => setImportType(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="full" />
                  <Label htmlFor="full" className="font-normal cursor-pointer">
                    Complet (remplacer tout)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="incremental" id="incremental" />
                  <Label htmlFor="incremental" className="font-normal cursor-pointer">
                    Incrémental (nouveaux uniquement)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Auto-enrichissement */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-enrich"
                checked={autoEnrich}
                onCheckedChange={(checked) => setAutoEnrich(checked as boolean)}
              />
              <Label htmlFor="auto-enrich" className="font-normal cursor-pointer">
                Enrichir automatiquement après import
              </Label>
            </div>

            {/* Matching par EAN */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="match-ean"
                checked={matchByEan}
                onCheckedChange={(checked) => setMatchByEan(checked as boolean)}
              />
              <Label htmlFor="match-ean" className="font-normal cursor-pointer">
                Matcher avec produits existants (EAN)
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowOptions(false)}>
                Annuler
              </Button>
              <Button onClick={handleImportWithOptions}>
                <Upload className="w-4 h-4 mr-2" />
                Lancer l'import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <ImportProgressDialog 
        open={isImporting}
        progress={importProgress}
      />
    </>
  );
};

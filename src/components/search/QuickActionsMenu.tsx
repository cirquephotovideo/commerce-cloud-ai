import { Upload, Zap, Download, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export const QuickActionsMenu = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleImportQuick = () => {
    navigate("/import-export-dashboard");
    toast({
      title: "📥 Import Rapide",
      description: "Accédez à la page d'import pour charger vos fichiers",
    });
  };

  const handleMassEnrichment = () => {
    navigate("/unified-products");
    toast({
      title: "⚡ Enrichissement Massif",
      description: "Sélectionnez les produits à enrichir depuis la gestion unifiée",
    });
  };

  const handleMultiExport = () => {
    navigate("/code2asin-export");
    toast({
      title: "📤 Export Multi-Plateformes",
      description: "Exportez vos produits vers Amazon, PrestaShop, etc.",
    });
  };

  const handleCode2AsinGeneration = () => {
    navigate("/code2asin-tracker");
    toast({
      title: "🔖 Génération Code2ASIN",
      description: "Générez vos enrichissements Amazon",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" className="gap-2">
          <Zap className="h-4 w-4" />
          Actions Rapides
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>⚡ Actions Rapides</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleImportQuick} className="cursor-pointer">
          <Upload className="mr-2 h-4 w-4" />
          <span>📥 Import Rapide CSV</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleMassEnrichment} className="cursor-pointer">
          <Zap className="mr-2 h-4 w-4" />
          <span>⚡ Enrichissement Massif</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleMultiExport} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4" />
          <span>📤 Export Multi-Plateformes</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleCode2AsinGeneration} className="cursor-pointer">
          <Tag className="mr-2 h-4 w-4" />
          <span>🔖 Génération Code2ASIN</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

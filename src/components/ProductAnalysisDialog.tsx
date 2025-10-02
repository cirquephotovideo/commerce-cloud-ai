import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { TechnicalAnalysis } from "./advanced/TechnicalAnalysis";
import { RiskAnalysis } from "./advanced/RiskAnalysis";
import { Microscope, ShieldAlert, Globe } from "lucide-react";

interface ProductAnalysisDialogProps {
  productUrl: string;
  productName: string;
}

export const ProductAnalysisDialog = ({ productUrl, productName }: ProductAnalysisDialogProps) => {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<string>("auto");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Microscope className="w-4 h-4 mr-2" />
          Analyses
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Analyses Avancées - {productName || productUrl.split('/').pop() || 'Produit'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="platform-select">Source d'analyse</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger id="platform-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Détection automatique
                  </div>
                </SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="ebay">eBay</SelectItem>
                <SelectItem value="aliexpress">AliExpress</SelectItem>
                <SelectItem value="cdiscount">Cdiscount</SelectItem>
                <SelectItem value="fnac">Fnac</SelectItem>
                <SelectItem value="darty">Darty</SelectItem>
                <SelectItem value="boulanger">Boulanger</SelectItem>
                <SelectItem value="custom">URL personnalisée</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choisissez la plateforme source pour une analyse optimisée
            </p>
          </div>
        </div>
        
        <Tabs defaultValue="technical" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="technical">
              <Microscope className="w-4 h-4 mr-2" />
              Technique
            </TabsTrigger>
            <TabsTrigger value="risk">
              <ShieldAlert className="w-4 h-4 mr-2" />
              Risques
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="technical" className="mt-6">
            <TechnicalAnalysis initialUrl={productUrl} platform={platform} />
          </TabsContent>
          
          <TabsContent value="risk" className="mt-6">
            <RiskAnalysis initialUrl={productUrl} platform={platform} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { TechnicalAnalysis } from "./advanced/TechnicalAnalysis";
import { RiskAnalysis } from "./advanced/RiskAnalysis";
import { Microscope, ShieldAlert } from "lucide-react";

interface ProductAnalysisDialogProps {
  productUrl: string;
  productName: string;
}

export const ProductAnalysisDialog = ({ productUrl, productName }: ProductAnalysisDialogProps) => {
  const [open, setOpen] = useState(false);

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
          <DialogTitle>Analyses Avancées - {productName}</DialogTitle>
        </DialogHeader>
        
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
            <TechnicalAnalysis initialUrl={productUrl} />
          </TabsContent>
          
          <TabsContent value="risk" className="mt-6">
            <RiskAnalysis initialUrl={productUrl} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
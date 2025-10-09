import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, Sparkles, Image, Video, FileCheck, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BatchEnrichmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: Set<string>;
  onComplete?: () => void;
}

export function BatchEnrichmentDialog({
  open,
  onOpenChange,
  selectedProducts,
  onComplete,
}: BatchEnrichmentDialogProps) {
  const [enrichmentOptions, setEnrichmentOptions] = useState({
    amazon: false,
    images: false,
    video: false,
    rsgp: false,
  });
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState<Array<{
    id: string;
    name: string;
    status: "pending" | "processing" | "completed" | "failed";
  }>>([]);

  const selectedCount = selectedProducts.size;
  const selectedOptionsCount = Object.values(enrichmentOptions).filter(Boolean).length;
  const estimatedTime = selectedCount * selectedOptionsCount * 0.5; // 30s per option per product
  const estimatedCost = selectedCount * selectedOptionsCount * 0.02; // €0.02 per enrichment

  const handleStartEnrichment = async () => {
    const options = Object.entries(enrichmentOptions)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);

    if (options.length === 0) {
      toast.error("Veuillez sélectionner au moins une option d'enrichissement");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Créer les tâches dans la queue
      const tasks = Array.from(selectedProducts).map(productId => ({
        user_id: user.id,
        supplier_product_id: productId,
        enrichment_type: options,
        priority,
        status: "pending" as const,
      }));

      const { error } = await supabase.from("enrichment_queue").insert(tasks);
      if (error) throw error;

      // Simuler le traitement (à remplacer par un vrai système de queue)
      const productsList = Array.from(selectedProducts).map((id, i) => ({
        id,
        name: `Produit ${i + 1}`,
        status: "pending" as const,
      }));
      
      setQueue(productsList);

      for (let i = 0; i < productsList.length; i++) {
        setQueue(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: "processing" } : p
        ));
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
        
        setQueue(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: "completed" } : p
        ));
        
        setProgress(((i + 1) / productsList.length) * 100);
      }

      toast.success(`${selectedCount} produits enrichis avec succès !`);
      onComplete?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erreur enrichissement:", error);
      toast.error("Erreur lors de l'enrichissement");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Enrichissement Batch
          </DialogTitle>
          <DialogDescription>
            {selectedCount} produit{selectedCount > 1 ? "s" : ""} sélectionné{selectedCount > 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {!isProcessing ? (
          <div className="space-y-6">
            {/* Options d'enrichissement */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Options d'enrichissement</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <Checkbox
                    id="amazon"
                    checked={enrichmentOptions.amazon}
                    onCheckedChange={(checked) =>
                      setEnrichmentOptions(prev => ({ ...prev, amazon: !!checked }))
                    }
                  />
                  <label htmlFor="amazon" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Package className="h-4 w-4" />
                    <span className="text-sm">Amazon Data</span>
                  </label>
                </div>

                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <Checkbox
                    id="images"
                    checked={enrichmentOptions.images}
                    onCheckedChange={(checked) =>
                      setEnrichmentOptions(prev => ({ ...prev, images: !!checked }))
                    }
                  />
                  <label htmlFor="images" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Image className="h-4 w-4" />
                    <span className="text-sm">Images AI</span>
                  </label>
                </div>

                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <Checkbox
                    id="video"
                    checked={enrichmentOptions.video}
                    onCheckedChange={(checked) =>
                      setEnrichmentOptions(prev => ({ ...prev, video: !!checked }))
                    }
                  />
                  <label htmlFor="video" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Video className="h-4 w-4" />
                    <span className="text-sm">Vidéos HeyGen</span>
                  </label>
                </div>

                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <Checkbox
                    id="rsgp"
                    checked={enrichmentOptions.rsgp}
                    onCheckedChange={(checked) =>
                      setEnrichmentOptions(prev => ({ ...prev, rsgp: !!checked }))
                    }
                  />
                  <label htmlFor="rsgp" className="flex items-center gap-2 cursor-pointer flex-1">
                    <FileCheck className="h-4 w-4" />
                    <span className="text-sm">RSGP</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Priorité */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Priorité</h3>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Basse priorité</SelectItem>
                  <SelectItem value="normal">🟡 Normale</SelectItem>
                  <SelectItem value="high">🔴 Haute priorité</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estimation */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Estimation</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Temps estimé</span>
                <span className="font-semibold">~{Math.ceil(estimatedTime)} min</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Coût IA estimé</span>
                <span className="font-semibold">~{estimatedCost.toFixed(2)}€</span>
              </div>
            </div>

            <Button
              onClick={handleStartEnrichment}
              disabled={selectedOptionsCount === 0}
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Lancer l'enrichissement
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progression globale</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {item.status === "pending" && (
                      <div className="h-4 w-4 rounded-full border-2 border-muted" />
                    )}
                    {item.status === "processing" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {item.status === "completed" && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {item.status === "failed" && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <Badge
                    variant={
                      item.status === "completed"
                        ? "default"
                        : item.status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {item.status === "pending" && "En attente"}
                    {item.status === "processing" && "En cours"}
                    {item.status === "completed" && "Terminé"}
                    {item.status === "failed" && "Échec"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

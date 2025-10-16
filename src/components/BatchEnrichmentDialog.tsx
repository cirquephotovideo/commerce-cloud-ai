import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Image, Video, FileCheck, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAIProvider } from "@/hooks/useAIProvider";
import { EnrichmentProviderSelector, AIProvider } from "@/components/product-detail/EnrichmentProviderSelector";

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
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const { provider, updateProvider } = useAIProvider();

  const selectedCount = selectedProducts.size;
  const selectedOptionsCount = Object.values(enrichmentOptions).filter(Boolean).length;
  const estimatedTime = selectedCount * selectedOptionsCount * 0.5; // 30s per option per product
  const estimatedCost = selectedCount * selectedOptionsCount * 0.02; // €0.02 per enrichment

  // Always include 'basic' enrichment
  const getEnrichmentTypes = () => {
    const types = ['basic']; // Always include basic analysis
    Object.entries(enrichmentOptions)
      .filter(([_, enabled]) => enabled)
      .forEach(([key]) => types.push(key));
    return types;
  };

  const getProviderIcon = (provider: AIProvider) => {
    const icons = {
      'lovable': '🚀',
      'claude': '🤖',
      'openai': '🔥',
      'openrouter': '🌐',
      'ollama_cloud': '☁️',
      'ollama_local': '💻'
    };
    return icons[provider];
  };

  const getProviderName = (provider: AIProvider) => {
    const names = {
      'lovable': 'Lovable AI',
      'claude': 'Claude',
      'openai': 'OpenAI',
      'openrouter': 'OpenRouter',
      'ollama_cloud': 'Ollama Cloud',
      'ollama_local': 'Ollama Local'
    };
    return names[provider];
  };

  const getModelForProvider = (provider: AIProvider): string | undefined => {
    const mapping: Record<AIProvider, string | undefined> = {
      'lovable': 'google/gemini-2.5-flash',
      'claude': 'claude-sonnet-4-5',
      'openai': 'gpt-5-mini',
      'openrouter': undefined,
      'ollama_cloud': 'qwen:110b-cloud',
      'ollama_local': 'llama3.1:latest',
    };
    return mapping[provider];
  };

  const handleStartEnrichment = async () => {
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const enrichmentTypes = getEnrichmentTypes();

      // Créer les tâches dans la queue
      const tasks = Array.from(selectedProducts).map(productId => ({
        user_id: user.id,
        supplier_product_id: productId,
        enrichment_type: enrichmentTypes,
        priority,
        status: "pending" as const,
        metadata: {
          provider,
          model: getModelForProvider(provider)
        }
      }));

      const { error: insertError } = await supabase.from("enrichment_queue").insert(tasks);
      if (insertError) throw insertError;

      toast.success(`${selectedCount} produits ajoutés à la file d'enrichissement`);

      // Déclencher le traitement
      const { data: processResult, error: processError } = await supabase.functions.invoke(
        'process-enrichment-queue',
        { body: { maxItems: Math.min(selectedCount, 10) } }
      );

      if (processError) {
        console.error('Erreur traitement:', processError);
        toast.error("Enrichissement démarré mais erreurs possibles. Vérifiez l'historique.");
      } else {
        const { success = 0, errors = 0 } = processResult || {};
        if (success > 0) {
          toast.success(`${success} produit${success > 1 ? 's' : ''} enrichi${success > 1 ? 's' : ''} ! Consultez le Dashboard.`);
        }
        if (errors > 0) {
          toast.error(`${errors} échec${errors > 1 ? 's' : ''} d'enrichissement`);
        }
      }

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
            {/* Provider IA */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Provider IA</h3>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Provider actuel:</span>
                  <Badge variant="secondary" className="text-sm">
                    {getProviderIcon(provider)} {getProviderName(provider)}
                  </Badge>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowProviderSelector(true)}
                >
                  ✏️ Changer
                </Button>
              </div>
            </div>

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
              disabled={isProcessing}
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Lancer l'enrichissement
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="font-medium">Enrichissement en cours...</p>
              <p className="text-sm text-muted-foreground">
                Les produits sont en train d'être traités. Vous pouvez fermer cette fenêtre.
              </p>
              <p className="text-sm text-muted-foreground">
                Les résultats apparaîtront dans le Dashboard et l'Historique.
              </p>
            </div>
          </div>
        )}
      </DialogContent>

      <EnrichmentProviderSelector
        open={showProviderSelector}
        onOpenChange={setShowProviderSelector}
        onSelect={(newProvider) => {
          updateProvider(newProvider);
          toast.success(`Provider changé: ${getProviderName(newProvider)}`);
        }}
      />
    </Dialog>
  );
}

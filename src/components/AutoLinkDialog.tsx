import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowRight, Check, X } from "lucide-react";
import { autoLinkProducts, createProductLink, MatchSuggestion } from "@/lib/productMatching";
import { toast } from "sonner";

interface AutoLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onComplete: () => void;
}

export function AutoLinkDialog({ open, onOpenChange, userId, onComplete }: AutoLinkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadSuggestions();
    }
  }, [open]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const matches = await autoLinkProducts(userId);
      setSuggestions(matches);
      
      if (matches.length === 0) {
        toast.info("Aucune correspondance automatique trouvée");
      } else {
        toast.success(`${matches.length} correspondances trouvées`);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
      toast.error("Erreur lors de la recherche de correspondances");
    } finally {
      setLoading(false);
    }
  };

  const confirmLink = async (suggestion: MatchSuggestion) => {
    setProcessing(prev => new Set(prev).add(suggestion.supplier_product_id));
    
    try {
      await createProductLink(suggestion.supplier_product_id, suggestion.analysis_id);
      
      setSuggestions(prev => 
        prev.filter(s => s.supplier_product_id !== suggestion.supplier_product_id)
      );
      
      toast.success("✅ Liaison créée avec succès");
    } catch (error) {
      console.error('Error creating link:', error);
      toast.error("Erreur lors de la création de la liaison");
    } finally {
      setProcessing(prev => {
        const newSet = new Set(prev);
        newSet.delete(suggestion.supplier_product_id);
        return newSet;
      });
    }
  };

  const ignoreLink = (suggestion: MatchSuggestion) => {
    setSuggestions(prev => 
      prev.filter(s => s.supplier_product_id !== suggestion.supplier_product_id)
    );
  };

  const confirmAll = async () => {
    setLoading(true);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const suggestion of suggestions) {
      try {
        await createProductLink(suggestion.supplier_product_id, suggestion.analysis_id);
        successCount++;
      } catch (error) {
        console.error('Error linking:', error);
        errorCount++;
      }
    }
    
    toast.success(`${successCount} liaisons créées, ${errorCount} erreurs`);
    setSuggestions([]);
    setLoading(false);
    onComplete();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'default';
    if (confidence >= 80) return 'secondary';
    return 'outline';
  };

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case 'ean': return '🎯 EAN exact';
      case 'brand': return '🏷️ Marque + Nom';
      case 'name': return '📝 Nom similaire';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Suggestions de liaison automatique
          </DialogTitle>
          <DialogDescription>
            {loading ? 
              "Recherche de correspondances..." : 
              `${suggestions.length} correspondance(s) trouvée(s)`
            }
          </DialogDescription>
        </DialogHeader>

        {loading && suggestions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            {suggestions.length > 0 && (
              <div className="flex justify-between items-center pb-4 border-b">
                <p className="text-sm text-muted-foreground">
                  Vérifiez et confirmez les correspondances proposées
                </p>
                <Button onClick={confirmAll} disabled={loading}>
                  <Check className="w-4 h-4 mr-2" />
                  Tout confirmer ({suggestions.length})
                </Button>
              </div>
            )}

            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <Card key={suggestion.supplier_product_id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Supplier Product */}
                        <div className="flex-1">
                          <Badge variant="secondary" className="mb-2">
                            Fournisseur
                          </Badge>
                          <p className="font-semibold">
                            {suggestion.supplierProduct?.product_name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            EAN: {suggestion.supplierProduct?.ean || 'N/A'} • 
                            {suggestion.supplierProduct?.supplier_configurations?.supplier_name}
                          </p>
                        </div>

                        {/* Arrow + Score */}
                        <div className="flex flex-col items-center gap-2 px-4">
                          <ArrowRight className="w-8 h-8 text-muted-foreground" />
                          <Badge variant={getConfidenceColor(suggestion.confidence)}>
                            {suggestion.confidence}%
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {getMatchTypeLabel(suggestion.match_type)}
                          </p>
                        </div>

                        {/* Analysis */}
                        <div className="flex-1">
                          <Badge className="mb-2">Analyse</Badge>
                          <p className="font-semibold">
                            {suggestion.analysis?.analysis_result?.name || 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {suggestion.analysis?.analysis_result?.category || 'N/A'}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => confirmLink(suggestion)}
                            disabled={processing.has(suggestion.supplier_product_id)}
                          >
                            {processing.has(suggestion.supplier_product_id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Confirmer
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => ignoreLink(suggestion)}
                            disabled={processing.has(suggestion.supplier_product_id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {suggestions.length === 0 && !loading && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Aucune correspondance trouvée</p>
                    <p className="text-sm mt-2">
                      Essayez d'enrichir davantage de produits pour améliorer les suggestions
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

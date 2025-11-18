import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Package, Link as LinkIcon } from "lucide-react";

interface LinkProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productEan?: string;
  productType: 'code2asin' | 'supplier';
  onLinked?: () => void;
}

export const LinkProductDialog = ({
  open,
  onOpenChange,
  productId,
  productName,
  productEan,
  productType,
  onLinked,
}: LinkProductDialogProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  // Charger les analyses disponibles
  const { data: analyses, isLoading } = useQuery({
    queryKey: ["analyses-for-linking", searchTerm],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("product_analyses")
        .select("id, ean, analysis_result, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (searchTerm && searchTerm.length >= 2) {
        const pattern = `%${searchTerm}%`;
        query = query.or(`ean.ilike.${pattern},analysis_result->>name.ilike.${pattern},analysis_result->>description.ilike.${pattern}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Mutation pour créer le lien
  const linkMutation = useMutation({
    mutationFn: async (analysisId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Créer le product_link
      const { data, error } = await supabase
        .from("product_links")
        .insert({
          analysis_id: analysisId,
          supplier_product_id: productType === 'supplier' ? productId : null,
          link_type: 'manual',
          confidence_score: 1.0,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        // Vérifier si c'est un doublon
        if (error.code === '23505') {
          throw new Error("Ce produit est déjà lié à cette analyse");
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Lien créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["code2asin-tab"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-tab"] });
      queryClient.invalidateQueries({ queryKey: ["analyses-tab"] });
      onLinked?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Error linking product:", error);
      toast.error(error.message || "Erreur lors de la création du lien");
    },
  });

  const handleLink = (analysisId: string) => {
    linkMutation.mutate(analysisId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Lier à une analyse
          </DialogTitle>
          <DialogDescription>
            Sélectionnez l'analyse à lier avec <strong>{productName}</strong>
            {productEan && <span className="ml-1">(EAN: {productEan})</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou EAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Liste des analyses */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Chargement des analyses...
              </div>
            ) : !analyses || analyses.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchTerm ? "Aucune analyse trouvée" : "Aucune analyse disponible"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((analysis) => {
                  const result = analysis.analysis_result as any;
                  const productTitle = result?.name || result?.description || "Sans titre";
                  const imageUrl = result?.image_url || result?.images?.[0];

                  return (
                    <div
                      key={analysis.id}
                      className="border rounded-lg p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {imageUrl && (
                          <img
                            src={imageUrl}
                            alt={productTitle}
                            className="h-16 w-16 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium line-clamp-2 mb-2">
                            {productTitle}
                          </h4>
                          {analysis.ean && (
                            <Badge variant="outline" className="mb-2">
                              EAN: {analysis.ean}
                            </Badge>
                          )}
                          {result?.brand && (
                            <p className="text-sm text-muted-foreground">
                              Marque: {result.brand}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleLink(analysis.id)}
                          disabled={linkMutation.isPending}
                        >
                          {linkMutation.isPending ? "..." : "Lier"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

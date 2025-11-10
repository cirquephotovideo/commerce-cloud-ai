import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const AutoLinkPanel = () => {
  const [isLinking, setIsLinking] = useState(false);
  const queryClient = useQueryClient();

  const handleAutoLink = async () => {
    setIsLinking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("auto-link-products", {
        body: {
          user_id: user.id,
          auto_mode: true,
          min_confidence: 95,
        },
      });

      if (error) throw error;

      toast.success(`✅ ${data.links_created || 0} produit(s) lié(s) automatiquement`);
      
      // Invalider les caches pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
      queryClient.invalidateQueries({ queryKey: ["product-analyses"] });
      queryClient.invalidateQueries({ queryKey: ["global-product-stats"] });
    } catch (error) {
      console.error("Auto-link error:", error);
      toast.error("Erreur lors de la fusion automatique");
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Card className="p-6 bg-primary/5 border-primary/20">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-[300px]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            🤖 Fusion Automatique par EAN
          </h2>
          <p className="text-muted-foreground mt-2">
            Analyse automatique de vos produits fournisseurs pour détecter les correspondances
            avec vos produits analysés via l'EAN.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              ✅ <strong>100% confiance</strong> : EAN identique → Lien automatique
            </li>
            <li>
              🔍 <strong>75-99% confiance</strong> : Similarité nom + marque → Suggestion
            </li>
            <li>
              ❌ <strong>&lt; 75% confiance</strong> : Pas de lien créé
            </li>
          </ul>
        </div>
        <Button size="lg" onClick={handleAutoLink} disabled={isLinking}>
          {isLinking ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Link className="h-4 w-4 mr-2" />
              Lancer la Fusion
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};

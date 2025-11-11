import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, Loader2, CheckCircle2, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const AutoLinkPanel = () => {
  const [isLinking, setIsLinking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState({
    linksCreated: 0,
    executionTime: 0,
    potentialMatches: 0,
  });
  const queryClient = useQueryClient();

  const handleAutoLink = async () => {
    setIsLinking(true);
    setProgress(0);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !session) throw new Error("Not authenticated");

      // Animation de progression
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      const invokeWithToken = async (jwt: string) =>
        await supabase.functions.invoke("auto-link-products", {
          body: {
            user_id: user.id,
            auto_mode: true,
            min_confidence: 95,
          },
          headers: { Authorization: `Bearer ${jwt}` },
        });

      // First try with current session token
      let { data, error } = await invokeWithToken(session.access_token);

      // If unauthorized, try refreshing the session once and retry
      if (error && (error.message?.includes("401") || error.message?.toLowerCase().includes("unauthorized"))) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session?.access_token) {
          ({ data, error } = await invokeWithToken(refreshed.session.access_token));
        }
      }

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      // Afficher le récapitulatif
      setSummary({
        linksCreated: data.links_created || 0,
        executionTime: data.execution_time_ms || 0,
        potentialMatches: data.potential_matches || 0,
      });
      setShowSummary(true);
      
      toast.success(`✅ ${data.links_created || 0} produit(s) lié(s) automatiquement`);
      
      // Invalider les caches pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
      queryClient.invalidateQueries({ queryKey: ["product-analyses"] });
      queryClient.invalidateQueries({ queryKey: ["global-product-stats"] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-products-count"] });
      queryClient.invalidateQueries({ queryKey: ["analyses-tab"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-tab"] });
      queryClient.invalidateQueries({ queryKey: ["product-links"] });
    } catch (error) {
      console.error("Auto-link error:", error);
      toast.error("Erreur lors de la fusion automatique");
    } finally {
      setIsLinking(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };
  return (
    <>
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
        
        {isLinking && progress > 0 && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              Traitement en cours... {progress}%
            </p>
          </div>
        )}
      </Card>

      {/* Dialog récapitulatif */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Fusion Terminée !
            </DialogTitle>
            <DialogDescription>
              Récapitulatif de l'opération de fusion automatique
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5 text-green-600" />
                <span className="font-medium">Liens créés</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {summary.linksCreated.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="font-medium">Taux de correspondance</span>
              </div>
              <span className="text-xl font-bold text-primary">
                {summary.potentialMatches > 0 
                  ? Math.round((summary.linksCreated / summary.potentialMatches) * 100)
                  : 0}%
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Temps d'exécution</span>
              </div>
              <span className="text-lg font-semibold">
                {summary.executionTime < 1000 
                  ? `${summary.executionTime}ms`
                  : `${(summary.executionTime / 1000).toFixed(2)}s`}
              </span>
            </div>
          </div>

          <Button onClick={() => setShowSummary(false)} className="w-full">
            Fermer
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

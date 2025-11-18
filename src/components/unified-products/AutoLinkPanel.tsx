import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, Loader2, CheckCircle2, Clock } from "lucide-react";
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        setIsLinking(false);
        return;
      }

      const { data, error } = await supabase.rpc('bulk_create_all_supplier_links_by_ean', {
        p_user_id: user.id
      });

      if (error) throw error;

      const result = data[0];
      
      setSummary({
        linksCreated: result.links_created,
        executionTime: result.execution_time_ms,
        potentialMatches: result.products_matched,
      });
      
      setProgress(100);
      setShowSummary(true);
      toast.success(`✅ ${result.links_created} liens créés pour ${result.products_matched} produits !`);
      
      queryClient.invalidateQueries({ queryKey: ['product-links'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['unified-products'] });
      
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la liaison automatique");
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Link className="w-5 h-5" />
              Fusion Multi-Fournisseurs par EAN
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Lie automatiquement TOUS les fournisseurs avec le même EAN
            </p>
          </div>

          {isLinking && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button onClick={handleAutoLink} disabled={isLinking} className="w-full" size="lg">
            {isLinking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Fusion en cours...
              </>
            ) : (
              <>
                <Link className="w-4 h-4 mr-2" />
                Lancer la Fusion
              </>
            )}
          </Button>
        </div>
      </Card>

      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Fusion Terminée
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Liens créés</p>
                <p className="text-2xl font-bold text-green-600">{summary.linksCreated}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Produits matchés</p>
                <p className="text-2xl font-bold text-blue-600">{summary.potentialMatches}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{summary.executionTime}ms</span>
            </div>

            <Button onClick={() => setShowSummary(false)} className="w-full">Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
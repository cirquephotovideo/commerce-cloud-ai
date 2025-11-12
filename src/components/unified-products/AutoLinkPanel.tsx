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
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
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
    setProcessedCount(0);
    setTotalToProcess(0);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Vous devez être connecté");
        setIsLinking(false);
        return;
      }

      console.log('[AutoLinkPanel] Starting auto-link job');
      
      const startTime = Date.now();
      
      // Step 1: Start the job
      const { data: startData, error: startError } = await supabase.functions.invoke('auto-link-products', {
        body: { mode: 'start', batch_size: 100 },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (startError) {
        console.error('[AutoLinkPanel] Error starting job:', startError);
        throw startError;
      }

      const jobId = startData.job_id;
      const totalProducts = startData.total_to_process;
      setTotalToProcess(totalProducts);
      
      console.log('[AutoLinkPanel] Job started:', jobId, 'Total products:', totalProducts);

      // Step 2: Poll for status
      let pollCount = 0;
      const maxPolls = 300; // 10 minutes max (2s interval)
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        if (pollCount > maxPolls) {
          clearInterval(pollInterval);
          toast.error("Timeout - Le traitement prend trop de temps");
          setIsLinking(false);
          return;
        }

        try {
          const { data: statusData, error: statusError } = await supabase.functions.invoke('auto-link-products', {
            body: { mode: 'status', job_id: jobId },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });

          if (statusError) {
            console.error('[AutoLinkPanel] Error getting status:', statusError);
            clearInterval(pollInterval);
            toast.error("Erreur lors de la vérification du statut");
            setIsLinking(false);
            return;
          }

          const currentProgress = totalProducts > 0 
            ? Math.round((statusData.processed_count / totalProducts) * 100)
            : 0;
          
          setProgress(currentProgress);
          setProcessedCount(statusData.processed_count);

          console.log('[AutoLinkPanel] Status:', statusData.status, 'Progress:', currentProgress);

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            const executionTime = Date.now() - startTime;
            
            console.log('[AutoLinkPanel] Job completed:', statusData.links_created, 'links created');
            
            toast.success(`✅ ${statusData.links_created} liens créés avec succès !`);
            
            setSummary({
              linksCreated: statusData.links_created,
              executionTime: executionTime,
              potentialMatches: totalProducts
            });
            setShowSummary(true);
            
            queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
            queryClient.invalidateQueries({ queryKey: ["product-analyses"] });
            queryClient.invalidateQueries({ queryKey: ["global-product-stats"] });
            queryClient.invalidateQueries({ queryKey: ["unlinked-products-count"] });
            queryClient.invalidateQueries({ queryKey: ["analyses-tab"] });
            queryClient.invalidateQueries({ queryKey: ["suppliers-tab"] });
            queryClient.invalidateQueries({ queryKey: ["product-links"] });
            
            setIsLinking(false);
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            toast.error('Erreur: ' + (statusData.error_message || 'Le traitement a échoué'));
            setIsLinking(false);
          }
        } catch (pollError: any) {
          console.error('[AutoLinkPanel] Polling error:', pollError);
          clearInterval(pollInterval);
          toast.error("Erreur lors du suivi du traitement");
          setIsLinking(false);
        }
      }, 2000); // Poll every 2 seconds
      
    } catch (error: any) {
      console.error('[AutoLinkPanel] Error:', error);
      toast.error(error.message || "Erreur lors de la fusion automatique");
      setIsLinking(false);
      setProgress(0);
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
        
        {isLinking && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              {progress < 100 ? (
                <>Traitement en cours... {progress}% ({processedCount.toLocaleString()}/{totalToProcess.toLocaleString()} produits)</>
              ) : (
                <>Finalisation...</>
              )}
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

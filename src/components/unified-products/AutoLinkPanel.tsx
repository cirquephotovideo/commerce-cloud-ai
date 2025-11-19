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
    setSummary({ linksCreated: 0, executionTime: 0, potentialMatches: 0 });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        setIsLinking(false);
        return;
      }

      const startTime = Date.now();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-link-suppliers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.error) {
              throw new Error(data.error);
            }
            
            if (data.complete) {
              const executionTime = Date.now() - startTime;
              setSummary({
                linksCreated: data.totalLinks,
                executionTime,
                potentialMatches: data.totalProcessed,
              });
              setProgress(100);
              setShowSummary(true);
              toast.success(
                `✅ ${data.totalLinks} liens créés pour ${data.totalProcessed} produits en ${Math.round(executionTime/1000)}s !`
              );
              break;
            }
            
            if (data.batch) {
              const estimatedProgress = Math.min(95, (data.batch * 2));
              setProgress(estimatedProgress);
              setSummary(prev => ({
                ...prev,
                linksCreated: data.totalLinks,
                potentialMatches: data.totalProcessed,
              }));
              
              if (data.batch % 10 === 0) {
                toast.info(`Batch ${data.batch}: ${data.totalLinks} liens créés...`, {
                  duration: 2000,
                });
              }
            }
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['product-links'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      queryClient.invalidateQueries({ queryKey: ['unified-products'] });
      
    } catch (error: any) {
      console.error('[AUTO-LINK] Error:', error);
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
              {summary.linksCreated > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  {summary.linksCreated} liens créés sur {summary.potentialMatches} produits traités...
                </div>
              )}
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShoppingCart, Loader2, Link2, CheckCircle, XCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAmazonProductLinks } from "@/hooks/useAmazonProductLinks";
import { useAmazonAutoLinkJob } from "@/hooks/useAmazonAutoLinkJob";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AmazonAutoLinkPanel() {
  const { startAutoLink } = useAmazonProductLinks();
  const { currentJob, isJobRunning, progress, reloadJob } = useAmazonAutoLinkJob();
  const [isStarting, setIsStarting] = useState(false);
  const { toast } = useToast();
  const [stats, setStats] = useState({
    total_analyses: 0,
    total_enrichments: 0,
    linked_count: 0,
    potential_matches: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  // Reload stats when job completes
  useEffect(() => {
    if (currentJob?.status === 'completed') {
      loadStats();
    }
  }, [currentJob?.status]);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Count analyses with non-empty EAN
      const { count: analysesCount } = await supabase
        .from('product_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('ean', 'is', null)
        .neq('ean', '');

      // Count enrichments
      const { count: enrichmentsCount } = await supabase
        .from('code2asin_enrichments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Count existing links
      const { count: linksCount } = await supabase
        .from('product_amazon_links')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const potentialMatches = Math.max(0, 
        Math.min(analysesCount || 0, enrichmentsCount || 0) - (linksCount || 0)
      );

      setStats({
        total_analyses: analysesCount || 0,
        total_enrichments: enrichmentsCount || 0,
        linked_count: linksCount || 0,
        potential_matches: potentialMatches
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleAutoLink = async () => {
    setIsStarting(true);
    try {
      await startAutoLink();
      await reloadJob();
    } catch (error) {
      console.error('Error starting auto-link:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const cancelJob = async () => {
    if (!currentJob?.id) return;
    
    try {
      const { error } = await supabase
        .from('amazon_auto_link_jobs')
        .update({
          status: 'failed',
          error_message: 'Annulé par l\'utilisateur',
          completed_at: new Date().toISOString()
        })
        .eq('id', currentJob.id);
      
      if (error) throw error;
      
      await reloadJob();
      await loadStats();
      
      toast({
        title: "Job annulé",
        description: "Vous pouvez maintenant relancer la fusion",
      });
    } catch (error) {
      console.error('Error canceling job:', error);
    }
  };

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-orange-500" />
          Fusion Automatique Amazon
        </CardTitle>
        <CardDescription>
          Liez automatiquement vos produits analysés avec les données Amazon (Code2ASIN)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Produits Analysés</p>
            <p className="text-2xl font-bold">{stats.total_analyses}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Enrichissements Amazon</p>
            <p className="text-2xl font-bold">{stats.total_enrichments}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-muted-foreground">Déjà Liés</p>
            <p className="text-2xl font-bold text-green-600">{stats.linked_count}</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-muted-foreground">À Lier</p>
            <p className="text-2xl font-bold text-orange-600">{stats.potential_matches}</p>
          </div>
        </div>

        {isJobRunning ? (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                <h4 className="font-semibold text-blue-900">
                  Fusion Amazon en cours...
                </h4>
              </div>
              <Badge variant="secondary">
                {progress}%
              </Badge>
            </div>
            
            <Progress value={progress} className="h-2" />
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Traités :</span>
                <span className="font-medium ml-2">{currentJob?.processed_count || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Liens créés :</span>
                <span className="font-medium ml-2 text-green-600">{currentJob?.links_created || 0}</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm"
              onClick={cancelJob}
              className="mt-2 w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Annuler ce Job
            </Button>
          </div>
        ) : currentJob?.status === 'completed' ? (
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-900">
                Fusion Terminée
              </h4>
            </div>
            <p className="text-sm text-green-700">
              {currentJob.links_created} nouveau{currentJob.links_created > 1 ? 'x' : ''} lien{currentJob.links_created > 1 ? 's' : ''} Amazon créé{currentJob.links_created > 1 ? 's' : ''}
            </p>
            <Button
              onClick={handleAutoLink}
              disabled={isStarting || stats.potential_matches === 0}
              className="mt-3"
              size="sm"
            >
              <Link2 className="h-4 w-4 mr-2" />
              Relancer
            </Button>
          </div>
        ) : currentJob?.status === 'failed' ? (
          <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <h4 className="font-semibold text-red-900">
                Erreur de Fusion
              </h4>
            </div>
            <p className="text-sm text-red-700 mb-3">
              {currentJob.error_message || 'Une erreur est survenue'}
            </p>
            <Button
              onClick={handleAutoLink}
              disabled={isStarting}
              variant="destructive"
              size="sm"
            >
              <Link2 className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
            <div className="flex-1">
              <h4 className="font-semibold text-orange-900 mb-1">
                Lien automatique par EAN
              </h4>
              <p className="text-sm text-orange-700">
                Le système va matcher automatiquement les produits ayant le même code EAN
              </p>
              {stats.potential_matches > 0 && (
                <Badge variant="secondary" className="mt-2">
                  <Link2 className="h-3 w-3 mr-1" />
                  {stats.potential_matches} correspondance{stats.potential_matches > 1 ? 's' : ''} potentielle{stats.potential_matches > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <Button
              onClick={handleAutoLink}
              disabled={isStarting || stats.potential_matches === 0}
              className="ml-4"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Démarrage...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Lancer la Fusion
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

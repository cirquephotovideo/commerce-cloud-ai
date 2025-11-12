import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Clock, Loader2, Package, TrendingUp, Users, Play, Pause, SkipForward, RefreshCw, HelpCircle, AlertTriangle, PlayCircle } from "lucide-react";
import { useSupplierSync } from "@/hooks/useSupplierSync";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function SupplierSyncHealth() {
  const { 
    fixStuckEnrichments, 
    retryFailedEnrichments, 
    pauseEnrichments, 
    skipFailedProducts,
    unlockAllStuckProducts,
    isFixing, 
    isRetrying, 
    isPausing, 
    isSkipping,
    isUnlockingAll
  } = useSupplierSync();
  
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const queryClient = useQueryClient();

  // Check if enrichments are paused
  const { data: systemSettings } = useQuery({
    queryKey: ['system-settings', 'enrichment_paused'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'enrichment_paused')
        .single();
      return data;
    },
    refetchInterval: 10000,
  });

  const isPaused = (systemSettings?.value as any)?.paused || false;
  const [isEmergencyRecovery, setIsEmergencyRecovery] = useState(false);

  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ['supplier-sync-health'],
    queryFn: async () => {
      console.log('📊 [HEALTH] Fetching system health data...');
      
      // Get exact counts for each status using head count
      const [
        { count: countCompleted },
        { count: countEnriching },
        { count: countFailed },
        { count: countPending },
        { count: countSkipped },
        { count: totalProducts },
      ] = await Promise.all([
        supabase.from('supplier_products').select('*', { count: 'exact', head: true }).eq('enrichment_status', 'completed'),
        supabase.from('supplier_products').select('*', { count: 'exact', head: true }).eq('enrichment_status', 'enriching'),
        supabase.from('supplier_products').select('*', { count: 'exact', head: true }).eq('enrichment_status', 'failed'),
        supabase.from('supplier_products').select('*', { count: 'exact', head: true }).eq('enrichment_status', 'pending'),
        supabase.from('supplier_products').select('*', { count: 'exact', head: true }).eq('enrichment_status', 'skipped'),
        supabase.from('supplier_products').select('*', { count: 'exact', head: true }),
      ]);

      const statusCounts = {
        completed: countCompleted || 0,
        enriching: countEnriching || 0,
        failed: countFailed || 0,
        pending: countPending || 0,
        skipped: countSkipped || 0,
      };

      // Get stuck products (enriching for more than 10 minutes)
      const { count: stuckCount } = await supabase
        .from('supplier_products')
        .select('*', { count: 'exact', head: true })
        .eq('enrichment_status', 'enriching')
        .lt('last_updated', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      // Get enrichment queue status with exact counts
      const [
        { count: queuePending },
        { count: queueProcessing },
      ] = await Promise.all([
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      ]);

      const totalQueue = (queuePending || 0) + (queueProcessing || 0);

      // Get recent import jobs success rate
      const { data: recentJobs } = await supabase
        .from('import_jobs')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const successJobs = recentJobs?.filter(j => j.status === 'completed').length || 0;
      const failedJobs = recentJobs?.filter(j => j.status === 'failed').length || 0;
      const totalJobs = recentJobs?.length || 0;

      // Get suppliers needing sync
      const { data: suppliers } = await supabase
        .from('supplier_configurations')
        .select('id, supplier_name, last_sync_at')
        .eq('is_active', true)
        .order('last_sync_at', { ascending: true })
        .limit(5);

      console.log('📊 [HEALTH] Stats:', { statusCounts, stuckCount, queuePending, queueProcessing, totalQueue });

      return {
        statusCounts,
        totalProducts: totalProducts || 0,
        stuckProducts: stuckCount || 0,
        queuePending: queuePending || 0,
        queueProcessing: queueProcessing || 0,
        totalQueue,
        recentJobs: {
          success: successJobs,
          failed: failedJobs,
          total: totalJobs,
        },
        suppliersToSync: suppliers || [],
      };
    },
    refetchInterval: (query) => {
      // Refresh every 5 seconds if there's activity, otherwise 30 seconds
      const data = query.state.data;
      const hasActivity = data && (
        data.queuePending > 0 || 
        data.queueProcessing > 0 || 
        data.stuckProducts > 0 ||
        data.statusCounts.failed > 0
      );
      return hasActivity ? 5000 : 30000;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 animate-spin" />
            Chargement...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const hasIssues = (healthData?.stuckProducts || 0) > 0 || (healthData?.statusCounts.failed || 0) > 0;
  const successRate = healthData?.recentJobs.total
    ? ((healthData.recentJobs.success / healthData.recentJobs.total) * 100).toFixed(0)
    : '0';

  const runDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    try {
      console.log('🔍 [DIAGNOSTIC] Calling system-diagnostic...');
      const { data, error } = await supabase.functions.invoke('system-diagnostic');
      
      if (error) {
        console.error('🔍 [DIAGNOSTIC] Error:', error);
        toast.error('Erreur diagnostic', { 
          description: error.message || 'Impossible d\'exécuter le diagnostic' 
        });
        return;
      }
      
      const { diagnosis } = data;
      console.log('🔍 [DIAGNOSTIC] Results:', diagnosis);
      
      if (diagnosis.severity === 'critical') {
        toast.error('🚨 Problèmes critiques détectés', {
          description: diagnosis.issues?.slice(0, 2).join(' • ') || 'Voir console pour détails',
        });
      } else if (diagnosis.severity === 'warning') {
        toast.warning('⚠️ Attention requise', {
          description: diagnosis.issues?.slice(0, 2).join(' • ') || 'Voir console pour détails',
        });
      } else {
        toast.success('✅ Système en bonne santé', {
          description: 'Aucun problème détecté',
        });
      }
      
      if (diagnosis.recommendations?.length > 0) {
        console.log('💡 Recommandations:', diagnosis.recommendations);
      }
    } catch (error: any) {
      console.error('🔍 [DIAGNOSTIC] Exception:', error);
      toast.error('Erreur diagnostic', { 
        description: error?.message || 'Erreur inconnue' 
      });
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  return (
    <div className="space-y-4">
      {isPaused && (
        <Alert variant="destructive">
          <Pause className="h-4 w-4" />
          <AlertTitle>⏸️ Enrichissements en pause</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Tous les enrichissements automatiques sont suspendus</span>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => pauseEnrichments.mutate(false)}
              disabled={isPausing}
            >
              <Play className="h-4 w-4 mr-2" />
              Reprendre
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Alerte critique si nécessaire */}
      {healthData && (healthData.statusCounts.failed > 0 || healthData.statusCounts.enriching > 1000) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>🚨 Intervention requise</AlertTitle>
          <AlertDescription className="space-y-3">
            {healthData.statusCounts.failed > 0 && (
              <p>• <strong>{healthData.statusCounts.failed} produits en erreur</strong> nécessitent une action</p>
            )}
            {healthData.statusCounts.enriching > 1000 && (
              <p>• <strong>{healthData.statusCounts.enriching} produits bloqués</strong> en statut "enriching"</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {healthData.statusCounts.enriching > 10000 ? (
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => unlockAllStuckProducts.mutate()}
                  disabled={isUnlockingAll}
                >
                  {isUnlockingAll ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  🚀 Déblocage complet automatique ({healthData.statusCounts.enriching.toLocaleString()})
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => fixStuckEnrichments.mutate()}
                  disabled={isFixing}
                >
                  {isFixing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Débloquer tout ({healthData.statusCounts.enriching})
                </Button>
              )}
              {healthData.statusCounts.failed > 0 && (
                <>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => retryFailedEnrichments.mutate()}
                    disabled={isRetrying}
                  >
                    {isRetrying ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      '🔄'
                    )}
                    Réessayer les erreurs ({healthData.statusCounts.failed})
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => skipFailedProducts.mutate()}
                    disabled={isSkipping}
                  >
                    {isSkipping ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      '⏭️'
                    )}
                    Ignorer les erreurs
                  </Button>
                </>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Emergency Recovery Alert */}
      {healthData && healthData.statusCounts.enriching > 10000 && healthData.totalQueue === 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>🚨 Situation critique détectée</AlertTitle>
          <AlertDescription>
            <p className="mb-3">
              {healthData.statusCounts.enriching.toLocaleString()} produits bloqués avec une file d'enrichissement vide.
              Cette situation nécessite une récupération d'urgence immédiate.
            </p>
            <Button 
              variant="destructive" 
              size="lg"
              onClick={async () => {
                setIsEmergencyRecovery(true);
                toast.info('🚨 Récupération d\'urgence en cours...', {
                  description: 'Déblocage des produits et création des tâches manquantes'
                });
                
                try {
                  const { data: fixData, error: fixError } = await supabase.functions.invoke('fix-stuck-enrichments');
                  
                  if (fixError) throw fixError;
                  
                  toast.success('✅ Étape 1/2 : Déblocage terminé', {
                    description: `${fixData?.fixed || 0} produits débloqués, ${fixData?.tasks_created || 0} tâches créées`
                  });
                  
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  
                  const { error: processError } = await supabase.functions.invoke('process-enrichment-queue', {
                    body: { maxItems: 100, parallel: true }
                  });
                  
                  if (processError) throw processError;
                  
                  toast.success('🚀 Étape 2/2 : Traitement démarré', {
                    description: 'L\'enrichissement a repris, consultez la progression ci-dessous'
                  });
                  
                  refetch();
                  queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
                } catch (err: any) {
                  console.error('Emergency recovery error:', err);
                  toast.error('❌ Erreur lors de la récupération', {
                    description: err.message || 'Réessayez ou contactez le support'
                  });
                } finally {
                  setIsEmergencyRecovery(false);
                }
              }}
              disabled={isEmergencyRecovery || isFixing}
              className="w-full sm:w-auto"
            >
              {isEmergencyRecovery ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Récupération en cours...
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  🚨 RÉCUPÉRATION D'URGENCE
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className={hasIssues ? "border-amber-500" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {hasIssues ? (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                ) : (
                  <Clock className="h-5 w-5" />
                )}
                Santé du système de synchronisation
              </CardTitle>
              <CardDescription>
                Vue d'ensemble de l'état des imports et enrichissements
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={runDiagnostic}
                disabled={isRunningDiagnostic}
              >
                {isRunningDiagnostic ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  '🔍'
                )}
                Diagnostic complet
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pauseEnrichments.mutate(!isPaused)}
                disabled={isPausing}
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Reprendre
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Statistics Overview */}
          {healthData && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Enrichis</div>
                <div className="text-2xl font-bold text-green-500">
                  {healthData.statusCounts.completed}
                </div>
                <div className="text-xs text-muted-foreground">
                  {healthData.totalProducts > 0 
                    ? `${((healthData.statusCounts.completed / healthData.totalProducts) * 100).toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">En cours</div>
                <div className="text-2xl font-bold text-blue-500">
                  {healthData.statusCounts.enriching}
                </div>
                <div className="text-xs text-muted-foreground">
                  {healthData.totalProducts > 0 
                    ? `${((healthData.statusCounts.enriching / healthData.totalProducts) * 100).toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">En attente</div>
                <div className="text-2xl font-bold text-amber-500">
                  {healthData.statusCounts.pending}
                </div>
                <div className="text-xs text-muted-foreground">
                  {healthData.totalProducts > 0 
                    ? `${((healthData.statusCounts.pending / healthData.totalProducts) * 100).toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Erreurs</div>
                <div className="text-2xl font-bold text-destructive">
                  {healthData.statusCounts.failed}
                </div>
                <div className="text-xs text-muted-foreground">
                  {healthData.totalProducts > 0 
                    ? `${((healthData.statusCounts.failed / healthData.totalProducts) * 100).toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Ignorés</div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {healthData.statusCounts.skipped}
                </div>
                <div className="text-xs text-muted-foreground">
                  {healthData.totalProducts > 0 
                    ? `${((healthData.statusCounts.skipped / healthData.totalProducts) * 100).toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {healthData && (healthData.stuckProducts > 0 || healthData.statusCounts.failed > 0) && (
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Actions rapides
              </h3>
              <div className="flex flex-wrap gap-2">
                {healthData.stuckProducts > 0 && (
                  <Button
                    onClick={() => fixStuckEnrichments.mutate()}
                    disabled={isFixing}
                    size="sm"
                    variant="outline"
                  >
                    {isFixing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Débloquer {healthData.stuckProducts} produits
                  </Button>
                )}
                
                {healthData.statusCounts.failed > 0 && (
                  <>
                    <Button
                      onClick={() => retryFailedEnrichments.mutate()}
                      disabled={isRetrying}
                      size="sm"
                      variant="outline"
                    >
                      {isRetrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Réessayer {healthData.statusCounts.failed} erreurs
                    </Button>
                    
                    <Button
                      onClick={() => skipFailedProducts.mutate()}
                      disabled={isSkipping}
                      size="sm"
                      variant="outline"
                    >
                      {isSkipping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <SkipForward className="mr-2 h-4 w-4" />
                      Ignorer les erreurs
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        toast.info('🚀 Relancement du processeur...');
                        try {
                          const { error } = await supabase.functions.invoke('process-enrichment-queue', {
                            body: { maxItems: 100, parallel: true }
                          });
                          if (error) throw error;
                          toast.success('✅ Processeur relancé');
                          refetch();
                        } catch (err: any) {
                          toast.error('Erreur', { description: err.message });
                        }
                      }}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Relancer le processeur
                    </Button>
                  </>
                )}
                
                {healthData.statusCounts.skipped > 0 && (
                  <Button
                    onClick={async () => {
                      toast.info('🔄 Réactivation des produits ignorés...');
                      try {
                        const { error } = await supabase
                          .from('supplier_products')
                          .update({ enrichment_status: 'pending' })
                          .eq('enrichment_status', 'skipped');
                        
                        if (error) throw error;
                        
                        toast.success('✅ Produits ignorés réactivés', {
                          description: `${healthData.statusCounts.skipped} produits remis en file d'attente`
                        });
                        refetch();
                        queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
                      } catch (err: any) {
                        toast.error('Erreur', { description: err.message });
                      }
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Réactiver {healthData.statusCounts.skipped} ignorés
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Enrichment Queue */}
          {healthData && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">File d'enrichissement</span>
                  {(healthData.queuePending > 0 || healthData.queueProcessing > 0) && (
                    <Badge variant="outline" className="animate-pulse">
                      🔴 Live
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    console.log('🔄 [HEALTH] Manual refresh triggered');
                    window.location.reload();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-500">{healthData.queuePending}</div>
                  <div className="text-xs text-muted-foreground">En attente</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">{healthData.queueProcessing}</div>
                  <div className="text-xs text-muted-foreground">En cours</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{healthData.totalQueue}</div>
                  <div className="text-xs text-muted-foreground">Dans la queue</div>
                </div>
              </div>
            </div>
          )}

          {/* Section d'aide au diagnostic */}
          {healthData && (
            healthData.statusCounts.enriching > 1000 || 
            healthData.statusCounts.failed > 0 || 
            (healthData.queuePending === 0 && healthData.queueProcessing === 0 && (healthData.stuckProducts > 0 || healthData.statusCounts.failed > 0))
          ) && (
            <Card className="border-blue-500 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Que faire maintenant ?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {healthData.statusCounts.enriching > 1000 && (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">1️⃣</span>
                    <div className="flex-1">
                      <strong className="block mb-1">Débloquer les {healthData.statusCounts.enriching} produits bloqués</strong>
                      <p className="text-muted-foreground text-xs mb-2">
                        Ces produits sont en statut "enriching" mais n'ont pas de tâche dans la queue. Cliquez sur "Débloquer tout" pour créer les tâches manquantes.
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => fixStuckEnrichments.mutate()}
                        disabled={isFixing}
                      >
                        {isFixing ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          '🔓'
                        )}
                        Débloquer maintenant
                      </Button>
                    </div>
                  </div>
                )}
                
                {healthData.statusCounts.failed > 0 && (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">2️⃣</span>
                    <div className="flex-1">
                      <strong className="block mb-1">Gérer les {healthData.statusCounts.failed} produits en erreur</strong>
                      <p className="text-muted-foreground text-xs mb-2">
                        Consultez les logs pour comprendre les erreurs, puis réessayez l'enrichissement ou ignorez-les définitivement.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => retryFailedEnrichments.mutate()}
                          disabled={isRetrying}
                        >
                          {isRetrying ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            '🔄'
                          )}
                          Réessayer
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => skipFailedProducts.mutate()}
                          disabled={isSkipping}
                        >
                          {isSkipping ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            '⏭️'
                          )}
                          Ignorer
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {healthData.queuePending === 0 && healthData.queueProcessing === 0 && (healthData.stuckProducts > 0 || healthData.statusCounts.failed > 0) && (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">3️⃣</span>
                    <div className="flex-1">
                      <strong className="block mb-1">Relancer le processeur de queue</strong>
                      <p className="text-muted-foreground text-xs mb-2">
                        La file d'enrichissement est vide. Relancez le processeur après avoir débloqué les produits.
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={async () => {
                          try {
                            await supabase.functions.invoke('process-enrichment-queue');
                            toast.success('Processeur relancé');
                          } catch (error) {
                            toast.error('Erreur lors du relancement');
                          }
                        }}
                      >
                        ▶️ Relancer le processeur
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Suppliers to Sync */}
          {healthData && healthData.suppliersToSync.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Fournisseurs à synchroniser</span>
              </div>
              <div className="space-y-1">
                {healthData.suppliersToSync.map((supplier: any) => {
                  const lastSync = supplier.last_sync_at ? new Date(supplier.last_sync_at) : null;
                  const hoursAgo = lastSync
                    ? Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60))
                    : null;

                  return (
                    <div key={supplier.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{supplier.supplier_name}</span>
                      <Badge variant="outline">
                        {hoursAgo === null ? 'Jamais' : `Il y a ${hoursAgo}h`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

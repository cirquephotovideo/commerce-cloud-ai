import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Clock, Loader2, Package, TrendingUp, Users, Play, Pause, SkipForward, RefreshCw } from "lucide-react";
import { useSupplierSync } from "@/hooks/useSupplierSync";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function SupplierSyncHealth() {
  const { 
    fixStuckEnrichments, 
    retryFailedEnrichments, 
    pauseEnrichments, 
    skipFailedProducts,
    isFixing, 
    isRetrying, 
    isPausing, 
    isSkipping 
  } = useSupplierSync();

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

  const { data: healthData, isLoading } = useQuery({
    queryKey: ['supplier-sync-health'],
    queryFn: async () => {
      // Get enrichment status breakdown
      const { data: statusBreakdown } = await supabase
        .from('supplier_products')
        .select('enrichment_status');

      const statusCounts = {
        enriching: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
      };

      statusBreakdown?.forEach(product => {
        const status = product.enrichment_status as keyof typeof statusCounts;
        if (status in statusCounts) {
          statusCounts[status]++;
        }
      });

      const totalProducts = statusBreakdown?.length || 0;

      // Get stuck products (enriching for more than 10 minutes)
      const { count: stuckCount } = await supabase
        .from('supplier_products')
        .select('*', { count: 'exact', head: true })
        .eq('enrichment_status', 'enriching')
        .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      // Get enrichment queue status
      const { data: queueStats } = await supabase
        .from('enrichment_queue')
        .select('status')
        .in('status', ['pending', 'processing']);

      const queuePending = queueStats?.filter(q => q.status === 'pending').length || 0;
      const queueProcessing = queueStats?.filter(q => q.status === 'processing').length || 0;

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

      return {
        statusCounts,
        totalProducts,
        stuckProducts: stuckCount || 0,
        queuePending,
        queueProcessing,
        recentJobs: {
          success: successJobs,
          failed: failedJobs,
          total: totalJobs,
        },
        suppliersToSync: suppliers || [],
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
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
                  </>
                )}
              </div>
            </div>
          )}

          {/* Enrichment Queue */}
          {healthData && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">File d'enrichissement</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{healthData.statusCounts.pending}</div>
                  <div className="text-xs text-muted-foreground">En attente</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{healthData.queueProcessing}</div>
                  <div className="text-xs text-muted-foreground">En cours</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{healthData.queuePending}</div>
                  <div className="text-xs text-muted-foreground">Dans la queue</div>
                </div>
              </div>
            </div>
          )}

          {/* Import Success Rate */}
          {healthData && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Taux de réussite (24h)</span>
                </div>
                <Badge>{successRate}%</Badge>
              </div>
              <Progress value={parseInt(successRate)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {healthData.recentJobs.success} réussis / {healthData.recentJobs.failed} échoués sur{' '}
                {healthData.recentJobs.total} imports
              </p>
            </div>
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

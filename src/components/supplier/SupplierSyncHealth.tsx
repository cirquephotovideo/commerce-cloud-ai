import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, TrendingDown, TrendingUp, Wrench } from 'lucide-react';
import { useSupplierSync } from '@/hooks/useSupplierSync';
import { Progress } from '@/components/ui/progress';

export const SupplierSyncHealth = () => {
  const { fixStuckEnrichments, isFixing } = useSupplierSync();

  const { data: healthData, isLoading } = useQuery({
    queryKey: ['supplier-sync-health'],
    queryFn: async () => {
      // Produits bloqués en enriching depuis > 10 min
      const { data: stuckProducts, error: stuckError } = await supabase
        .from('supplier_products')
        .select('id, enrichment_status, updated_at')
        .eq('enrichment_status', 'enriching')
        .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      if (stuckError) throw stuckError;

      // Produits en attente
      const { data: pendingProducts, error: pendingError } = await supabase
        .from('supplier_products')
        .select('id')
        .eq('enrichment_status', 'pending');

      if (pendingError) throw pendingError;

      // Tâches d'enrichissement actives
      const { data: queueTasks, error: queueError } = await supabase
        .from('enrichment_queue')
        .select('id, status')
        .in('status', ['pending', 'processing']);

      if (queueError) throw queueError;

      // Dernière synchronisation par fournisseur
      const { data: suppliers, error: suppliersError } = await supabase
        .from('supplier_configurations')
        .select('id, supplier_name, last_sync_at')
        .order('last_sync_at', { ascending: true })
        .limit(5);

      if (suppliersError) throw suppliersError;

      // Statistiques des imports récents
      const { data: recentImports, error: importsError } = await supabase
        .from('import_jobs')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (importsError) throw importsError;

      return {
        stuckCount: stuckProducts?.length || 0,
        pendingCount: pendingProducts?.length || 0,
        queuePending: queueTasks?.filter(t => t.status === 'pending').length || 0,
        queueProcessing: queueTasks?.filter(t => t.status === 'processing').length || 0,
        oldestSuppliers: suppliers || [],
        recentImportsSuccess: recentImports?.filter(i => i.status === 'completed').length || 0,
        recentImportsFailed: recentImports?.filter(i => i.status === 'failed').length || 0,
        recentImportsTotal: recentImports?.length || 0,
      };
    },
    refetchInterval: 30000, // Refresh toutes les 30 secondes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Santé du système de synchronisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  const hasIssues = (healthData?.stuckCount || 0) > 0 || (healthData?.pendingCount || 0) > 100;
  const successRate = healthData?.recentImportsTotal
    ? ((healthData.recentImportsSuccess / healthData.recentImportsTotal) * 100).toFixed(1)
    : '0';

  return (
    <Card className={hasIssues ? 'border-amber-500' : 'border-green-500'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {hasIssues ? (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          Santé du système de synchronisation
        </CardTitle>
        <CardDescription>
          Vue d'ensemble de l'état des imports et enrichissements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Produits bloqués */}
        {(healthData?.stuckCount || 0) > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Produits bloqués</span>
                <Badge variant="destructive">{healthData?.stuckCount}</Badge>
              </div>
              <Button
                size="sm"
                onClick={() => fixStuckEnrichments.mutate()}
                disabled={isFixing}
                variant="outline"
              >
                <Wrench className="h-4 w-4 mr-2" />
                {isFixing ? 'Déblocage...' : 'Débloquer'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {healthData?.stuckCount} produits sont en enrichissement depuis plus de 10 minutes
            </p>
          </div>
        )}

        {/* Queue d'enrichissement */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">File d'enrichissement</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-amber-500">{healthData?.pendingCount}</p>
              <p className="text-xs text-muted-foreground">En attente</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">{healthData?.queueProcessing}</p>
              <p className="text-xs text-muted-foreground">En cours</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{healthData?.queuePending}</p>
              <p className="text-xs text-muted-foreground">Dans la queue</p>
            </div>
          </div>
        </div>

        {/* Taux de réussite des imports */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {parseFloat(successRate) > 80 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-sm font-medium">Taux de réussite (24h)</span>
            </div>
            <Badge variant={parseFloat(successRate) > 80 ? 'default' : 'secondary'}>
              {successRate}%
            </Badge>
          </div>
          <Progress value={parseFloat(successRate)} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {healthData?.recentImportsSuccess} réussis / {healthData?.recentImportsFailed} échoués sur{' '}
            {healthData?.recentImportsTotal} imports
          </p>
        </div>

        {/* Fournisseurs nécessitant une synchronisation */}
        {healthData?.oldestSuppliers && healthData.oldestSuppliers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Fournisseurs à synchroniser</span>
            </div>
            <div className="space-y-1">
              {healthData.oldestSuppliers.map((supplier: any) => {
                const lastSync = supplier.last_sync_at
                  ? new Date(supplier.last_sync_at)
                  : null;
                const hoursAgo = lastSync
                  ? Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60))
                  : null;

                return (
                  <div key={supplier.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{supplier.supplier_name}</span>
                    <Badge variant="outline">
                      {hoursAgo === null ? 'Jamais' : `${hoursAgo}h`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

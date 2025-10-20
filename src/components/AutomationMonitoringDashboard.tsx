import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAutomationMonitoring } from '@/hooks/useAutomationMonitoring';
import { useAutomationStats } from '@/hooks/useAutomationStats';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, XCircle, AlertCircle, Activity } from 'lucide-react';

export const AutomationMonitoringDashboard = () => {
  const { recentActivity, runningAutomations } = useAutomationMonitoring();
  const { data: stats } = useAutomationStats();

  const globalStats = stats?.global;

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-500" />
            <CardTitle>État du système</CardTitle>
          </div>
          <CardDescription>
            Monitoring en temps réel des automatisations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div>
                <div className="font-semibold text-green-600">Système opérationnel</div>
                <div className="text-sm text-muted-foreground">
                  {globalStats?.active_rules || 0} règles actives
                </div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold">{globalStats?.total_rules || 0}</div>
                <div className="text-sm text-muted-foreground">Règles totales</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {globalStats?.total_successes || 0}
                </div>
                <div className="text-sm text-muted-foreground">Succès</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-destructive">
                  {globalStats?.total_errors || 0}
                </div>
                <div className="text-sm text-muted-foreground">Erreurs</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {runningAutomations?.totalRunning || 0}
                </div>
                <div className="text-sm text-muted-foreground">En cours</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Running Automations */}
      {runningAutomations && runningAutomations.totalRunning > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activité en direct</CardTitle>
            <CardDescription>Automatisations actuellement en cours d'exécution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {runningAutomations.importJobs?.map((job: any) => (
                <div key={job.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="font-medium">Import en cours</div>
                    <div className="text-sm text-muted-foreground">
                      {job.progress_current || 0} / {job.progress_total || 0} produits
                    </div>
                  </div>
                  <Badge variant="outline" className="text-blue-600">
                    {Math.round(((job.progress_current || 0) / (job.progress_total || 1)) * 100)}%
                  </Badge>
                </div>
              ))}
              {runningAutomations.enrichmentQueue?.map((task: any) => (
                <div key={task.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="font-medium">Enrichissement</div>
                    <div className="text-sm text-muted-foreground">
                      {task.enrichment_type?.join(', ') || 'En cours'}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-purple-600">
                    {task.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
          <CardDescription>Historique des 20 dernières exécutions</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentActivity || recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune activité récente
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {activity.status === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : activity.status === 'error' ? (
                    <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{activity.rule_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {activity.rule_category}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{activity.message}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

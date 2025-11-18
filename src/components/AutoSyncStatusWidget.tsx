import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const AutoSyncStatusWidget = () => {
  const { data: lastSync } = useQuery({
    queryKey: ['auto-sync-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('action_type', 'auto_sync_ean')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) return null;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Synchronisation Automatique
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lastSync ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Dernière synchro</span>
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {format(new Date(lastSync.created_at), 'HH:mm', { locale: fr })}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Liens créés</span>
              <span className="font-bold text-primary">
                {(lastSync.result_data as any)?.links_created || 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Produits matchés</span>
              <span className="font-bold text-primary">
                {(lastSync.result_data as any)?.products_matched || 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Temps d'exécution</span>
              <span className="text-sm">
                {(lastSync.result_data as any)?.execution_time_ms || 0}ms
              </span>
            </div>

            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Prochaine synchro automatique dans{' '}
                {60 - new Date().getMinutes()} minutes
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucune synchronisation effectuée
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function useRealtimeAlerts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('user-alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_alerts'
        },
        (payload) => {
          const alert = payload.new as any;
          
          // Invalider le cache des alertes
          queryClient.invalidateQueries({ queryKey: ['user-alerts'] });
          
          // Afficher une notification toast pour les alertes critiques
          if (alert.severity === 'critical') {
            toast.error(alert.title, {
              description: alert.message,
              duration: 10000,
            });
          } else if (alert.severity === 'warning') {
            toast.warning(alert.title, {
              description: alert.message,
              duration: 5000,
            });
          } else {
            toast.info(alert.title, {
              description: alert.message,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

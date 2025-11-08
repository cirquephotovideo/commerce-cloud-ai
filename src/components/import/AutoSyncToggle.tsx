import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock } from "lucide-react";

export const AutoSyncToggle = () => {
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  // Récupérer l'état actuel de la synchronisation automatique
  const { data: syncStatus } = useQuery({
    queryKey: ['auto-sync-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { enabled: false };

      const { data } = await supabase
        .from('supplier_configurations')
        .select('auto_sync_enabled')
        .eq('user_id', user.id)
        .or('supplier_type.eq.odoo,supplier_type.eq.prestashop,supplier_type.eq.api')
        .limit(1)
        .maybeSingle();

      return { enabled: data?.auto_sync_enabled || false };
    },
  });

  useEffect(() => {
    if (syncStatus) {
      setAutoSyncEnabled(syncStatus.enabled);
    }
  }, [syncStatus]);

  const toggleAutoSync = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      // Mettre à jour tous les supplier_configurations de type plateforme
      const { error } = await supabase
        .from('supplier_configurations')
        .update({
          auto_sync_enabled: enabled,
          sync_frequency: enabled ? 'daily' : 'manual',
        })
        .eq('user_id', user.id)
        .or('supplier_type.eq.odoo,supplier_type.eq.prestashop,supplier_type.eq.api');

      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      toast.success(
        enabled
          ? '✅ Synchronisation automatique activée (tous les jours à 2h)'
          : '❌ Synchronisation automatique désactivée'
      );
      setAutoSyncEnabled(enabled);
    },
    onError: (error: Error) => {
      console.error('Erreur toggle auto-sync:', error);
      toast.error(`Erreur : ${error.message}`);
      // Remettre l'ancien état en cas d'erreur
      setAutoSyncEnabled(!autoSyncEnabled);
    },
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">Synchronisation automatique</h3>
            <p className="text-sm text-muted-foreground">
              Synchroniser automatiquement tous les produits depuis vos plateformes
              <br />
              <span className="text-xs">Exécution quotidienne à 2h du matin</span>
            </p>
          </div>
        </div>
        <Switch
          checked={autoSyncEnabled}
          onCheckedChange={(checked) => {
            toggleAutoSync.mutate(checked);
          }}
          disabled={toggleAutoSync.isPending}
        />
      </div>
    </Card>
  );
};

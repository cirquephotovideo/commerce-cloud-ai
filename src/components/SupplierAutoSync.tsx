import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Zap } from "lucide-react";

interface SupplierAutoSyncProps {
  supplierId: string;
}

export const SupplierAutoSync = ({ supplierId }: SupplierAutoSyncProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['supplier-config', supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_configurations')
        .select('*')
        .eq('id', supplierId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from('supplier_configurations')
        .update(updates)
        .eq('id', supplierId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-config', supplierId] });
      toast({
        title: "Configuration mise à jour",
        description: "Les paramètres de synchronisation ont été sauvegardés",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la configuration",
        variant: "destructive",
      });
      console.error('Error updating config:', error);
    },
  });

  const triggerSync = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('supplier-sync-scheduler', {
        body: { supplierId },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Synchronisation lancée",
        description: "La synchronisation a été démarrée en arrière-plan",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de lancer la synchronisation",
        variant: "destructive",
      });
      console.error('Error triggering sync:', error);
    },
  });

  const autoLink = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('auto-link-supplier-products', {
        body: { userId: user.id, supplierId },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Auto-liaison terminée",
        description: "Les produits ont été liés automatiquement par EAN",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible d'effectuer l'auto-liaison",
        variant: "destructive",
      });
      console.error('Error auto-linking:', error);
    },
  });

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Synchronisation Automatique
        </CardTitle>
        <CardDescription>
          Configurez la synchronisation automatique avec ce fournisseur
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-sync enabled */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-sync">Synchronisation automatique</Label>
            <p className="text-sm text-muted-foreground">
              Synchroniser automatiquement les produits à intervalle régulier
            </p>
          </div>
          <Switch
            id="auto-sync"
            checked={config?.auto_sync_enabled || false}
            onCheckedChange={(checked) => {
              updateConfig.mutate({ auto_sync_enabled: checked });
            }}
          />
        </div>

        {/* Sync frequency */}
        {config?.auto_sync_enabled && (
          <div className="space-y-2">
            <Label htmlFor="sync-frequency">Fréquence de synchronisation</Label>
            <Select
              value={config?.sync_frequency || 'daily'}
              onValueChange={(value) => {
                updateConfig.mutate({ sync_frequency: value });
              }}
            >
              <SelectTrigger id="sync-frequency">
                <SelectValue placeholder="Choisir la fréquence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Toutes les heures</SelectItem>
                <SelectItem value="daily">Quotidienne</SelectItem>
                <SelectItem value="weekly">Hebdomadaire</SelectItem>
                <SelectItem value="manual">Manuelle uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Auto-link by EAN */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-link">Liaison automatique par EAN</Label>
            <p className="text-sm text-muted-foreground">
              Lier automatiquement les produits ayant le même code EAN
            </p>
          </div>
          <Switch
            id="auto-link"
            checked={config?.auto_link_by_ean || false}
            onCheckedChange={(checked) => {
              updateConfig.mutate({ auto_link_by_ean: checked });
            }}
          />
        </div>

        {/* Manual actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => triggerSync.mutate()}
            disabled={triggerSync.isPending}
            className="flex-1"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${triggerSync.isPending ? 'animate-spin' : ''}`} />
            Synchroniser maintenant
          </Button>
          <Button
            variant="outline"
            onClick={() => autoLink.mutate()}
            disabled={autoLink.isPending}
            className="flex-1"
          >
            <Zap className="w-4 h-4 mr-2" />
            Auto-lier les produits
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

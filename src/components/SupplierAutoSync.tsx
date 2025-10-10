import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SupplierAutoSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-supplier-sync');
      
      if (error) throw error;

      const successCount = data.successCount || 0;
      const warningCount = data.warningCount || 0;
      const errorCount = data.errorCount || 0;

      toast.success(
        `Synchronisation terminée: ${data.suppliers_processed} fournisseurs traités\n` +
        `✅ ${successCount} succès | ⚠️ ${warningCount} avertissements | ❌ ${errorCount} erreurs`,
        { duration: 5000 }
      );
      
      // Show detailed results
      if (data.results && data.results.length > 0) {
        const warnings = data.results.filter((r: any) => r.status === 'warning');
        if (warnings.length > 0) {
          console.log('Sync warnings:', warnings);
        }
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error("Erreur lors de la synchronisation automatique");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Synchronisation Automatique
        </CardTitle>
        <CardDescription>
          Synchronisez automatiquement tous vos fournisseurs actifs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Synchronisation manuelle */}
        <div className="space-y-2">
          <h3 className="font-semibold">Synchronisation Manuelle</h3>
          <p className="text-sm text-muted-foreground">
            Lancez une synchronisation immédiate de tous vos fournisseurs actifs
          </p>
          <Button 
            onClick={handleManualSync} 
            disabled={syncing}
            className="w-full"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Synchronisation en cours...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Synchroniser Maintenant
              </>
            )}
          </Button>
        </div>

        {/* Synchronisation automatique (planifiée) */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-sync" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Synchronisation Nocturne Automatique
              </Label>
              <p className="text-sm text-muted-foreground">
                Active la synchronisation quotidienne à 2h du matin
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={autoSyncEnabled}
              onCheckedChange={setAutoSyncEnabled}
            />
          </div>

          {autoSyncEnabled && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  Planifié quotidiennement à 02:00
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                💡 Pour activer la synchronisation automatique nocturne, configurez un cron job dans votre système:
              </p>
              <code className="block p-2 bg-background rounded text-xs">
                0 2 * * * curl -X POST {window.location.origin}/functions/v1/auto-supplier-sync
              </code>
              <p className="text-xs text-muted-foreground">
                Ou utilisez le planificateur Supabase pg_cron pour déclencher automatiquement.
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">📋 Fonctionnement</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Synchronise uniquement les fournisseurs actifs</li>
            <li>Ignore les fournisseurs de type "Fichier"</li>
            <li>Supporte: API, FTP, SFTP, PrestaShop, WooCommerce, Magento, Shopify, Odoo</li>
            <li>Mise à jour automatique de la date de dernière synchronisation</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

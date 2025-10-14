import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Zap, Settings } from "lucide-react";

export const AutoExportRules = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRule, setNewRule] = useState({
    platform_type: 'shopify',
    sync_frequency: 'on_new',
    conditions: {}
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['auto-export-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_export_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createRule = useMutation({
    mutationFn: async (rule: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('auto_export_rules')
        .insert({ ...rule, user_id: user.id });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-export-rules'] });
      setShowCreateDialog(false);
      toast({
        title: "Règle créée",
        description: "La règle d'export automatique a été créée",
      });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('auto_export_rules')
        .update({ enabled })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-export-rules'] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('auto_export_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-export-rules'] });
      toast({
        title: "Règle supprimée",
        description: "La règle d'export a été supprimée",
      });
    },
  });

  const platforms = [
    { value: 'shopify', label: 'Shopify' },
    { value: 'prestashop', label: 'PrestaShop' },
    { value: 'woocommerce', label: 'WooCommerce' },
    { value: 'magento', label: 'Magento' },
    { value: 'odoo', label: 'Odoo' },
  ];

  if (isLoading) return <div>Chargement...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Règles d'Export Automatique
            </CardTitle>
            <CardDescription>
              Configurez des exports automatiques vers vos plateformes
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Règle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une Règle d'Export</DialogTitle>
                <DialogDescription>
                  Définissez les conditions pour exporter automatiquement vos produits
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Plateforme de destination</Label>
                  <Select
                    value={newRule.platform_type}
                    onValueChange={(value) => setNewRule({ ...newRule, platform_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map(platform => (
                        <SelectItem key={platform.value} value={platform.value}>
                          {platform.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fréquence de synchronisation</Label>
                  <Select
                    value={newRule.sync_frequency}
                    onValueChange={(value) => setNewRule({ ...newRule, sync_frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_new">À chaque nouveau produit</SelectItem>
                      <SelectItem value="hourly">Toutes les heures</SelectItem>
                      <SelectItem value="daily">Quotidien</SelectItem>
                      <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => createRule.mutate(newRule)}
                  disabled={createRule.isPending}
                  className="w-full"
                >
                  Créer la Règle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!rules || rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune règle d'export configurée</p>
            <p className="text-sm mt-2">Créez une règle pour automatiser vos exports</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plateforme</TableHead>
                <TableHead>Fréquence</TableHead>
                <TableHead>Produits exportés</TableHead>
                <TableHead>Dernière synchro</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Badge variant="outline">{rule.platform_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {rule.sync_frequency === 'on_new' && 'Nouveau produit'}
                    {rule.sync_frequency === 'hourly' && 'Toutes les heures'}
                    {rule.sync_frequency === 'daily' && 'Quotidien'}
                    {rule.sync_frequency === 'weekly' && 'Hebdomadaire'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{rule.products_exported || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.last_sync_at 
                      ? new Date(rule.last_sync_at).toLocaleString()
                      : 'Jamais'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => 
                        toggleRule.mutate({ id: rule.id, enabled: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRule.mutate(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

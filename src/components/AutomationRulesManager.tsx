import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Zap, Plus, Trash2, Play, Pause, TrendingUp, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function AutomationRulesManager() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState("price_alert");
  const [threshold, setThreshold] = useState("10");
  const [action, setAction] = useState("create_alert");
  const queryClient = useQueryClient();

  // Fetch rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create rule mutation
  const createRule = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const conditions = {
        type: ruleType,
        threshold: parseFloat(threshold),
      };

      const actions = {
        type: action,
        parameters: {},
      };

      const { error } = await supabase
        .from("automation_rules")
        .insert({
          user_id: user.id,
          rule_name: ruleName,
          rule_type: ruleType,
          conditions,
          actions,
          is_active: true,
          priority: 5,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      setShowCreateDialog(false);
      setRuleName("");
      toast.success("Règle créée avec succès");
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Toggle active mutation
  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("automation_rules")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Statut mis à jour");
    },
  });

  // Delete mutation
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automation_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Règle supprimée");
    },
  });

  const ruleTypes = [
    { value: "price_alert", label: "Alerte prix", icon: TrendingUp },
    { value: "stock_alert", label: "Alerte stock", icon: AlertCircle },
    { value: "auto_link", label: "Liaison automatique", icon: Zap },
  ];

  const actionTypes = [
    { value: "create_alert", label: "Créer une alerte" },
    { value: "send_email", label: "Envoyer un email" },
    { value: "auto_link_products", label: "Lier automatiquement" },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Règles d'automatisation
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle règle
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : rules?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune règle configurée</p>
              <p className="text-sm mt-2">
                Créez des règles pour automatiser vos actions (alertes prix, liaison automatique...)
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Déclenchements</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules?.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.rule_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.rule_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {rule.conditions && typeof rule.conditions === "object" && (
                        <span>
                          Seuil: {(rule.conditions as any).threshold}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rule.actions && typeof rule.actions === "object" && (
                        <span>{(rule.actions as any).type}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rule.trigger_count || 0}x</Badge>
                    </TableCell>
                    <TableCell>
                      {rule.is_active ? (
                        <Badge className="bg-green-600">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleActive.mutate({ id: rule.id, isActive: rule.is_active })
                          }
                          title={rule.is_active ? "Désactiver" : "Activer"}
                        >
                          {rule.is_active ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRule.mutate(rule.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle règle d'automatisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom de la règle</Label>
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Ex: Alerte si prix augmente de 10%"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de règle</Label>
                <Select value={ruleType} onValueChange={setRuleType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ruleTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Seuil (%)</Label>
                <Input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Action à effectuer</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((act) => (
                    <SelectItem key={act.value} value={act.value}>
                      {act.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Résumé</h4>
              <p className="text-sm">
                <strong>SI</strong> {ruleType === "price_alert" && "le prix change de plus de "}
                {ruleType === "stock_alert" && "le stock passe sous "}
                {ruleType === "auto_link" && "un nouveau produit correspond à "}
                <strong>{threshold}%</strong>
                <br />
                <strong>ALORS</strong>{" "}
                {action === "create_alert" && "créer une alerte utilisateur"}
                {action === "send_email" && "envoyer un email"}
                {action === "auto_link_products" && "lier automatiquement le produit"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={() => createRule.mutate()} disabled={!ruleName || createRule.isPending}>
              Créer la règle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

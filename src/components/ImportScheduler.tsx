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
import { toast } from "sonner";
import { Calendar, Clock, Play, Pause, Trash2, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ImportScheduler() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [scheduleName, setScheduleName] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("daily");
  const [cronExpression, setCronExpression] = useState<string>("0 2 * * *");
  const queryClient = useQueryClient();

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-for-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_configurations")
        .select("id, supplier_name")
        .order("supplier_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch schedules
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["import-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_schedules")
        .select("*, supplier_configurations(supplier_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create schedule mutation
  const createSchedule = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await (supabase as any)
        .from("import_schedules")
        .insert({
          supplier_id: selectedSupplier,
          schedule_name: scheduleName,
          schedule_type: "email_imap",
          frequency,
          cron_expression: cronExpression,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-schedules"] });
      setShowCreateDialog(false);
      setSelectedSupplier("");
      setScheduleName("");
      toast.success("Planification créée avec succès");
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Toggle active mutation
  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("import_schedules")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-schedules"] });
      toast.success("Statut mis à jour");
    },
  });

  // Delete mutation
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("import_schedules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-schedules"] });
      toast.success("Planification supprimée");
    },
  });

  // Test schedule manually
  const testSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("process-scheduled-imports", {
        body: { schedule_id: id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Test lancé avec succès");
    },
  });

  const frequencyOptions = [
    { value: "hourly", label: "Toutes les heures" },
    { value: "daily", label: "Tous les jours" },
    { value: "weekly", label: "Toutes les semaines" },
    { value: "custom", label: "Personnalisé (CRON)" },
  ];

  const getCronPreset = (freq: string) => {
    switch (freq) {
      case "hourly": return "0 * * * *";
      case "daily": return "0 2 * * *";
      case "weekly": return "0 2 * * 1";
      default: return cronExpression;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Planification des imports
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle planification
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : schedules?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune planification configurée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fréquence</TableHead>
                  <TableHead>Prochain import</TableHead>
                  <TableHead>Dernier import</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules?.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      {(schedule.supplier_configurations as any)?.supplier_name || "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{schedule.schedule_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {schedule.frequency}
                      </div>
                    </TableCell>
                    <TableCell>
                      {schedule.next_run_at
                        ? new Date(schedule.next_run_at).toLocaleString("fr-FR")
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {schedule.last_run_at
                        ? new Date(schedule.last_run_at).toLocaleString("fr-FR")
                        : "Jamais"}
                    </TableCell>
                    <TableCell>
                      {schedule.is_active ? (
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
                          onClick={() => testSchedule.mutate(schedule.id)}
                          title="Tester maintenant"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleActive.mutate({ id: schedule.id, isActive: schedule.is_active })
                          }
                          title={schedule.is_active ? "Désactiver" : "Activer"}
                        >
                          {schedule.is_active ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSchedule.mutate(schedule.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle planification d'import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom de la planification</Label>
              <Input
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="Import quotidien fournisseur X"
              />
            </div>

            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un fournisseur" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.supplier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fréquence</Label>
              <Select
                value={frequency}
                onValueChange={(val) => {
                  setFrequency(val);
                  setCronExpression(getCronPreset(val));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencyOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {frequency === "custom" && (
              <div className="space-y-2">
                <Label>Expression CRON</Label>
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 2 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Format: minute heure jour mois jour-semaine
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createSchedule.mutate()}
              disabled={!selectedSupplier || !scheduleName || createSchedule.isPending}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

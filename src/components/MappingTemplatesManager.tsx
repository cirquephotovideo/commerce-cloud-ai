import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Copy, Star, Edit } from "lucide-react";

export function MappingTemplatesManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["mapping-templates"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("mapping_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("use_count", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("mapping_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapping-templates"] });
      toast({ title: "Template supprimé avec succès" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Désactiver tous les autres defaults
      await supabase
        .from("mapping_templates")
        .update({ is_default: false })
        .eq("user_id", user.id);

      // Activer celui-ci
      const { error } = await supabase
        .from("mapping_templates")
        .update({ is_default: true })
        .eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapping-templates"] });
      toast({ title: "Template défini par défaut" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("mapping_templates")
        .insert({
          user_id: user.id,
          template_name: `${template.template_name} (Copie)`,
          description: template.description,
          mapping_config: template.mapping_config,
          is_default: false,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapping-templates"] });
      toast({ title: "Template dupliqué avec succès" });
    },
  });

  if (isLoading) {
    return <div className="p-4">Chargement...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Templates de mapping</CardTitle>
            <CardDescription>
              Gérez vos templates de mapping réutilisables
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Nom du template</Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Ex: Fournisseur ABC"
                  />
                </div>
                <div>
                  <Label>Description (optionnel)</Label>
                  <Textarea
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    placeholder="Description du template"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Note: Le mapping sera configuré lors de l'utilisation du template dans l'assistant d'import
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Utilisations</TableHead>
              <TableHead>Défaut</TableHead>
              <TableHead>Date création</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates?.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.template_name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {template.description || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{template.use_count}</Badge>
                </TableCell>
                <TableCell>
                  {template.is_default ? (
                    <Badge className="bg-yellow-500">
                      <Star className="h-3 w-3 mr-1" />
                      Défaut
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefaultMutation.mutate(template.id)}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(template.created_at).toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateMutation.mutate(template)}
                      disabled={duplicateMutation.isPending}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Voulez-vous vraiment supprimer ce template ?")) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {templates?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun template configuré. Créez-en un pour réutiliser vos mappings.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

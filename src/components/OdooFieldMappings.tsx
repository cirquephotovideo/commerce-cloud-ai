import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

// Champs disponibles dans l'analyse
const SOURCE_FIELDS = [
  { value: "product_name", label: "Nom du produit", path: "product_name" },
  { value: "description", label: "Description", path: "description.suggested_description" },
  { value: "description_optimized", label: "Description optimisée", path: "description.optimized_description" },
  { value: "price", label: "Prix", path: "pricing.estimated_price" },
  { value: "category", label: "Catégorie", path: "tags_categories.primary_category" },
  { value: "seo_title", label: "Titre SEO", path: "seo.title" },
  { value: "seo_description", label: "Description SEO", path: "seo.meta_description" },
  { value: "seo_keywords", label: "Mots-clés SEO", path: "seo.keywords" },
  { value: "brand", label: "Marque", path: "brand" },
  { value: "weight", label: "Poids", path: "odoo_attributes.weight" },
  { value: "volume", label: "Volume", path: "odoo_attributes.volume" },
];

// Champs Odoo 19
const ODOO_FIELDS = [
  { value: "name", label: "Nom [name]" },
  { value: "description", label: "Description [description]" },
  { value: "description_sale", label: "Description de vente [description_sale]" },
  { value: "list_price", label: "Prix de vente [list_price]" },
  { value: "standard_price", label: "Coût [standard_price]" },
  { value: "default_code", label: "Référence interne [default_code]" },
  { value: "barcode", label: "Code-barres [barcode]" },
  { value: "categ_id", label: "Catégorie [categ_id]" },
  { value: "website_meta_title", label: "Titre SEO [website_meta_title]" },
  { value: "website_meta_description", label: "Meta Description [website_meta_description]" },
  { value: "website_meta_keywords", label: "Mots-clés Meta [website_meta_keywords]" },
  { value: "weight", label: "Poids [weight]" },
  { value: "volume", label: "Volume [volume]" },
  { value: "sale_ok", label: "Peut être vendu [sale_ok]" },
  { value: "purchase_ok", label: "Peut être acheté [purchase_ok]" },
  { value: "type", label: "Type de produit [type]" },
  { value: "website_published", label: "Publié sur le site [website_published]" },
];

interface FieldMapping {
  id: string;
  source_field: string;
  source_path: string;
  odoo_field: string;
  odoo_field_label: string;
  is_active: boolean;
}

export const OdooFieldMappings = () => {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({
    source_field: "",
    odoo_field: "",
  });

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('odoo_field_mappings')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMappings(data || []);
    } catch (error) {
      console.error('Error loading mappings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addMapping = async () => {
    if (!newMapping.source_field || !newMapping.odoo_field) {
      toast.error("Veuillez sélectionner les champs source et destination");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const sourceField = SOURCE_FIELDS.find(f => f.value === newMapping.source_field);
      const odooField = ODOO_FIELDS.find(f => f.value === newMapping.odoo_field);

      if (!sourceField || !odooField) return;

      const { error } = await supabase
        .from('odoo_field_mappings')
        .insert({
          user_id: user.id,
          source_field: sourceField.value,
          source_path: sourceField.path,
          odoo_field: odooField.value,
          odoo_field_label: odooField.label,
          is_active: true,
        });

      if (error) throw error;

      toast.success("Mapping ajouté avec succès");
      setIsDialogOpen(false);
      setNewMapping({ source_field: "", odoo_field: "" });
      loadMappings();
    } catch (error) {
      console.error('Error adding mapping:', error);
      toast.error("Erreur lors de l'ajout du mapping");
    }
  };

  const deleteMapping = async (id: string) => {
    try {
      const { error } = await supabase
        .from('odoo_field_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Mapping supprimé");
      loadMappings();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error("Erreur lors de la suppression");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Mapping des Champs</CardTitle>
            <CardDescription>
              Configurez la correspondance entre vos analyses et les champs Odoo 19
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau Mapping de Champ</DialogTitle>
                <DialogDescription>
                  Sélectionnez le champ source et le champ Odoo correspondant
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Champ Source (Analyse)</Label>
                  <Select
                    value={newMapping.source_field}
                    onValueChange={(value) =>
                      setNewMapping({ ...newMapping, source_field: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un champ" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Champ Odoo 19</Label>
                  <Select
                    value={newMapping.odoo_field}
                    onValueChange={(value) =>
                      setNewMapping({ ...newMapping, odoo_field: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un champ Odoo" />
                    </SelectTrigger>
                    <SelectContent>
                      {ODOO_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={addMapping} className="w-full">
                  Créer le mapping
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucun mapping configuré</p>
            <p className="text-sm mt-2">
              Cliquez sur "Ajouter" pour créer votre premier mapping
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {mappings.map((mapping) => {
              const sourceField = SOURCE_FIELDS.find(f => f.value === mapping.source_field);
              return (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Badge variant="outline">{sourceField?.label}</Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="secondary">{mapping.odoo_field_label}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMapping(mapping.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-2 text-sm">📋 Champs disponibles</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">Champs Source (Analyse):</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {SOURCE_FIELDS.map(f => (
                  <li key={f.value}>• {f.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Champs Odoo 19:</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {ODOO_FIELDS.slice(0, 10).map(f => (
                  <li key={f.value}>• {f.value}</li>
                ))}
                <li className="text-xs italic">... et {ODOO_FIELDS.length - 10} autres</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

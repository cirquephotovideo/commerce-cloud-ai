import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SupplierConnectionConfig } from "./SupplierConnectionConfig";
import { SupplierMappingConfig } from "./SupplierMappingConfig";

interface SupplierConfigurationProps {
  supplierId?: string | null;
  onClose: () => void;
}

export function SupplierConfiguration({ supplierId, onClose }: SupplierConfigurationProps) {
  const [loading, setLoading] = useState(false);
  type SupplierType = "email" | "ftp" | "sftp" | "api" | "prestashop" | "odoo" | "sap" | "file";
  
  const [formData, setFormData] = useState<{
    supplier_name: string;
    supplier_type: SupplierType;
    is_active: boolean;
    sync_frequency: string;
    connection_config: any;
    mapping_config: any;
  }>({
    supplier_name: "",
    supplier_type: "file",
    is_active: true,
    sync_frequency: "manual",
    connection_config: {},
    mapping_config: {},
  });

  useEffect(() => {
    if (supplierId) {
      loadSupplier();
    }
  }, [supplierId]);

  const loadSupplier = async () => {
    const { data, error } = await supabase
      .from("supplier_configurations")
      .select("*")
      .eq("id", supplierId)
      .single();

    if (error) {
      toast.error("Erreur lors du chargement du fournisseur");
      return;
    }

    setFormData(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Save mapping in both column_mapping and mapping_config for compatibility
      const dataToSave = {
        ...formData,
        column_mapping: formData.mapping_config,
        mapping_config: formData.mapping_config,
      };

      if (supplierId) {
        const { error } = await supabase
          .from("supplier_configurations")
          .update(dataToSave)
          .eq("id", supplierId);

        if (error) throw error;
        toast.success("Fournisseur mis à jour");
      } else {
        const { error } = await supabase
          .from("supplier_configurations")
          .insert([{ ...dataToSave, user_id: user.id }]);

        if (error) throw error;
        toast.success("Fournisseur créé");
      }

      onClose();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {supplierId ? "Modifier le fournisseur" : "Nouveau fournisseur"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Configuration</TabsTrigger>
              <TabsTrigger value="connection">Connexion</TabsTrigger>
              <TabsTrigger value="mapping">Mapping</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_name">Nom du fournisseur</Label>
                <Input
                  id="supplier_name"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier_type">Type de connexion</Label>
                <Select
                  value={formData.supplier_type}
                  onValueChange={(value: any) => setFormData({ ...formData, supplier_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">Fichier (CSV/Excel)</SelectItem>
                    <SelectItem value="ftp">FTP</SelectItem>
                    <SelectItem value="sftp">SFTP</SelectItem>
                    <SelectItem value="api">API REST</SelectItem>
                    <SelectItem value="prestashop">PrestaShop</SelectItem>
                    <SelectItem value="odoo">Odoo</SelectItem>
                    <SelectItem value="sap">SAP</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sync_frequency">Fréquence de synchronisation</Label>
                <Select
                  value={formData.sync_frequency}
                  onValueChange={(value) => setFormData({ ...formData, sync_frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manuel</SelectItem>
                    <SelectItem value="daily">Quotidien</SelectItem>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    <SelectItem value="monthly">Mensuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Actif</Label>
              </div>
            </TabsContent>

            <TabsContent value="connection" className="mt-4">
              <SupplierConnectionConfig
                supplierType={formData.supplier_type}
                config={formData.connection_config}
                onConfigChange={(config) => setFormData({ ...formData, connection_config: config })}
              />
            </TabsContent>

            <TabsContent value="mapping" className="mt-4">
              <SupplierMappingConfig
                supplierType={formData.supplier_type}
                mapping={formData.mapping_config}
                onMappingChange={(mapping) => setFormData({ ...formData, mapping_config: mapping })}
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

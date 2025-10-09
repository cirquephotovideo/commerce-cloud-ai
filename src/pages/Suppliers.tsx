import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Truck, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierConfiguration } from "@/components/SupplierConfiguration";
import { SupplierProductsTable } from "@/components/SupplierProductsTable";
import { SupplierImportWizard } from "@/components/SupplierImportWizard";
import { SupplierImportMenu } from "@/components/SupplierImportMenu";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Suppliers() {
  const { t } = useTranslation();
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const { data: suppliers, refetch: refetchSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_configurations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: importLogs } = useQuery({
    queryKey: ["supplier-import-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_import_logs")
        .select("*, supplier_configurations(supplier_name)")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const handleSync = async (supplierId: string) => {
    const supplier = suppliers?.find(s => s.id === supplierId);
    if (!supplier) return;

    toast.info("Synchronisation en cours...");
    
    try {
      let functionName = '';
      
      if (supplier.supplier_type === 'ftp' || supplier.supplier_type === 'sftp') {
        functionName = 'supplier-sync-ftp';
      } else if (supplier.supplier_type === 'api') {
        functionName = 'supplier-sync-api';
      } else {
        toast.error("Type de synchronisation non supporté");
        return;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { supplierId },
      });

      if (error) throw error;

      toast.success(`Synchronisation terminée: ${data.imported} produits importés`);
      refetchSuppliers();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error("Erreur lors de la synchronisation");
    }
  };

  const handleEdit = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setShowNewSupplier(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Fournisseurs</h1>
            <p className="text-muted-foreground">
              Gérez vos fournisseurs et importez leurs catalogues
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <SupplierImportMenu onImportComplete={() => refetchSuppliers()} />
          <Button onClick={() => setShowImportWizard(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setShowNewSupplier(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Fournisseur
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">Fournisseurs</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="logs">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {suppliers?.map((supplier) => (
            <Card key={supplier.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      {supplier.supplier_name}
                    </CardTitle>
                    <CardDescription>
                      Type: {supplier.supplier_type} • 
                      {supplier.last_sync_at
                        ? ` Dernière synchro: ${new Date(supplier.last_sync_at).toLocaleDateString()}`
                        : " Jamais synchronisé"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <SupplierImportMenu 
                      supplierId={supplier.id}
                      onImportComplete={() => refetchSuppliers()}
                    />
                    <Button variant="outline" size="sm" onClick={() => handleSync(supplier.id)}>
                      Synchroniser
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(supplier.id)}>
                      Modifier
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}

          {!suppliers?.length && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Truck className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Aucun fournisseur configuré</p>
                <Button onClick={() => setShowNewSupplier(true)}>
                  Ajouter votre premier fournisseur
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="products">
          <SupplierProductsTable />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {importLogs?.map((log) => (
            <Card key={log.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {log.supplier_configurations?.supplier_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {log.products_found} trouvés • {log.products_matched} matchés
                    </p>
                    <p className={`text-sm ${
                      log.import_status === 'success' ? 'text-green-600' :
                      log.import_status === 'partial' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {log.import_status}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {showNewSupplier && (
        <SupplierConfiguration
          supplierId={selectedSupplierId}
          onClose={() => {
            setShowNewSupplier(false);
            setSelectedSupplierId(null);
            refetchSuppliers();
          }}
        />
      )}

      {showImportWizard && (
        <SupplierImportWizard
          onClose={() => setShowImportWizard(false)}
        />
      )}
    </div>
  );
}

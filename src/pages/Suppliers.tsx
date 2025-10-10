import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Truck, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SupplierConfiguration } from "@/components/SupplierConfiguration";
import { SupplierProductsTable } from "@/components/SupplierProductsTable";
import { SupplierImportWizard } from "@/components/SupplierImportWizard";
import { SupplierImportMenu } from "@/components/SupplierImportMenu";
import { PlatformSettings } from "@/components/PlatformSettings";
import { SupplierAutoSync } from "@/components/SupplierAutoSync";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Suppliers() {
  const { t } = useTranslation();
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // Mapping des types de fournisseurs
  const supplierTypeLabels: Record<string, string> = {
    file: "📁 Fichier CSV/XLSX",
    ftp: "🌐 FTP",
    sftp: "🔒 SFTP",
    api: "⚡ API REST",
    prestashop: "🛒 PrestaShop",
    odoo: "🟣 Odoo",
    sap: "💼 SAP",
    email: "📧 Email",
  };

  const { data: suppliers, refetch: refetchSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_configurations")
        .select(`
          *,
          supplier_products(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transformer pour ajouter product_count
      return data?.map(s => ({
        ...s,
        product_count: s.supplier_products?.[0]?.count || 0
      }));
    },
  });

  // Statistiques fournisseurs
  const { data: stats } = useQuery({
    queryKey: ['supplier-stats'],
    queryFn: async () => {
      const { data: suppliers } = await supabase
        .from('supplier_configurations')
        .select('id, supplier_type, is_active');
      
      const { data: products } = await supabase
        .from('supplier_products')
        .select('id, enrichment_status');
      
      return {
        total_suppliers: suppliers?.length || 0,
        active_suppliers: suppliers?.filter(s => s.is_active).length || 0,
        total_products: products?.length || 0,
        pending_enrichment: products?.filter(p => p.enrichment_status === 'pending').length || 0,
      };
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

    // ✅ AJOUT : Vérifier que ce n'est pas un fichier
    if (supplier.supplier_type === 'file') {
      toast.error("❌ Les fournisseurs de type 'Fichier' ne peuvent pas être synchronisés automatiquement. Utilisez 'Import CSV/XLSX' à la place.");
      return;
    }

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
            Import CSV/XLSX
          </Button>
          <Button onClick={() => setShowNewSupplier(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Fournisseur
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{stats?.total_suppliers || 0}</div>
            <p className="text-sm text-muted-foreground">Fournisseurs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-500">{stats?.active_suppliers || 0}</div>
            <p className="text-sm text-muted-foreground">Actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{stats?.total_products || 0}</div>
            <p className="text-sm text-muted-foreground">Produits importés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-orange-500">{stats?.pending_enrichment || 0}</div>
            <p className="text-sm text-muted-foreground">En attente enrichissement</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">Fournisseurs</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="platforms">🔑 Plateformes E-commerce</TabsTrigger>
          <TabsTrigger value="logs">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dernière synchro</TableHead>
                    <TableHead>Produits</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers?.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{supplier.supplier_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {supplierTypeLabels[supplier.supplier_type] || supplier.supplier_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.is_active ? "default" : "secondary"}>
                          {supplier.is_active ? "✅ Actif" : "⏸️ Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {supplier.last_sync_at
                          ? new Date(supplier.last_sync_at).toLocaleDateString('fr-FR')
                          : "Jamais synchronisé"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {supplier.product_count || 0} produits
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <SupplierImportMenu 
                            supplierId={supplier.id}
                            onImportComplete={refetchSuppliers}
                          />
                          
                          {/* Bouton "Synchroniser" UNIQUEMENT si pas de type file */}
                          {supplier.supplier_type !== 'file' ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleSync(supplier.id)}
                            >
                              🔄 Synchroniser
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="sm" disabled>
                                    🔄 Synchroniser
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Les fournisseurs de type "Fichier" ne peuvent pas être synchronisés automatiquement.</p>
                                  <p>Utilisez le bouton "Import CSV/XLSX" pour importer manuellement.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(supplier.id)}
                          >
                            ✏️ Modifier
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!suppliers?.length && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Truck className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Aucun fournisseur configuré</p>
                  <Button onClick={() => setShowNewSupplier(true)}>
                    Ajouter votre premier fournisseur
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <SupplierProductsTable />
        </TabsContent>

        <TabsContent value="platforms" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlatformSettings />
            <SupplierAutoSync />
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>📜 Historique des imports</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Télécharger CSV des logs
                    const csv = "Date,Fournisseur,Trouvés,Matchés,Nouveaux,Statut\n" +
                      importLogs?.map(log => 
                        `${new Date(log.created_at).toLocaleString()},${log.supplier_configurations?.supplier_name},${log.products_found},${log.products_matched},${log.products_found - log.products_matched},${log.import_status}`
                      ).join("\n") || "";
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "historique-imports.csv";
                    a.click();
                  }}
                >
                  📥 Exporter CSV
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Trouvés</TableHead>
                    <TableHead>Matchés</TableHead>
                    <TableHead>Nouveaux</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importLogs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell>{log.supplier_configurations?.supplier_name}</TableCell>
                      <TableCell>{log.products_found}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.products_matched}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{log.products_found - log.products_matched}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          log.import_status === 'success' ? 'default' :
                          log.import_status === 'partial' ? 'secondary' :
                          'destructive'
                        }>
                          {log.import_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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

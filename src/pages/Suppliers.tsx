import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Truck, Plus, Upload, Trash2, Loader2, Clock, CheckCircle, Eye, Mail, AlertCircle, Settings, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportScheduler } from "@/components/ImportScheduler";
import { AutomationRulesManager } from "@/components/AutomationRulesManager";
import { AutomationMasterManager } from "@/components/AutomationMasterManager";
import { AutomationMonitoringDashboard } from "@/components/AutomationMonitoringDashboard";
import { OllamaHealthDashboard } from "@/components/OllamaHealthDashboard";
import { LiveImportProgress } from "@/components/LiveImportProgress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SupplierConfiguration } from "@/components/SupplierConfiguration";
import { SupplierProductsTable } from "@/components/SupplierProductsTable";
import { SupplierImportWizard } from "@/components/SupplierImportWizard";
import { SupplierImportMenu } from "@/components/SupplierImportMenu";
import { PlatformSettings } from "@/components/PlatformSettings";
import { SupplierAutoSync } from "@/components/SupplierAutoSync";
import { FTPMappingWizard } from "@/components/FTPMappingWizard";
import { EmailInboxTable } from "@/components/EmailInboxTable";
import { EmailSetupGuide } from "@/components/EmailSetupGuide";
import { EmailPollMonitoring } from "@/components/EmailPollMonitoring";
import { UserAlerts } from "@/components/market/UserAlerts";
import { SupplierProductLinksTab } from "@/components/SupplierProductLinksTab";
import { BulkProductLinksManager } from "@/components/BulkProductLinksManager";
import { ImportStatsDashboard } from "@/components/ImportStatsDashboard";
import { MappingTemplatesManager } from "@/components/MappingTemplatesManager";
import { SupplierMappingSetup } from "@/components/SupplierMappingSetup";
import { SupplierMappingPreview } from "@/components/SupplierMappingPreview";
import { UnifiedMappingDialog } from "@/components/mapping/UnifiedMappingDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SupplierSyncHealth } from "@/components/supplier/SupplierSyncHealth";
import { SupplierLogsPanel } from "@/components/supplier/SupplierLogsPanel";

// Progress cell component
function SupplierProgressCell({ supplierId }: { supplierId: string }) {
  const { data: progress } = useQuery({
    queryKey: ["supplier-progress", supplierId],
    queryFn: async () => {
      const { data: products } = await supabase
        .from("supplier_products")
        .select("id, enrichment_status")
        .eq("supplier_id", supplierId);

      const total = products?.length || 0;
      const enriched = products?.filter(p => p.enrichment_status === "completed").length || 0;
      
      return { total, enriched, percentage: total > 0 ? Math.round((enriched / total) * 100) : 0 };
    },
    refetchInterval: 10000, // Refresh every 10s
  });

  if (!progress || progress.total === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <Progress value={progress.percentage} className="h-2" />
      <span className="text-xs text-muted-foreground">
        {progress.enriched} / {progress.total} enrichis
      </span>
    </div>
  );
}

export default function Suppliers() {
  const { t } = useTranslation();
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showFTPWizard, setShowFTPWizard] = useState(false);
  const [showMappingWizard, setShowMappingWizard] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>("");
  const [selectedSupplierType, setSelectedSupplierType] = useState<'email' | 'ftp' | 'file' | 'api'>('file');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  
  // Bulk delete states
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 });
  const [totalProductsToDelete, setTotalProductsToDelete] = useState(0);

  // Manual email poll handler
  const handleManualEmailPoll = async () => {
    toast.info("🔄 Vérification des emails en cours...");
    
    const { data, error } = await supabase.functions.invoke('email-imap-scheduler');
    
    if (error) {
      toast.error(`❌ Erreur : ${error.message}`);
      console.error('Scheduler error:', error);
      return;
    }
    
    const results = data?.results || [];
    const successCount = results.filter((r: any) => r.status === 'success').length;
    const errorCount = results.filter((r: any) => r.status === 'error').length;
    const totalPolled = data?.polled || 0;
    
    console.log('Scheduler results:', results);
    
    if (successCount > 0) {
      toast.success(`✅ ${successCount} fournisseur(s) vérifié(s), ${errorCount} erreur(s)`);
    } else if (errorCount > 0) {
      toast.error(`❌ ${errorCount} erreur(s) lors de la vérification`);
    } else {
      toast.info(`ℹ️ ${totalPolled} fournisseur(s) vérifié(s), aucun nouvel email`);
    }
    
    // Rafraîchir après 2 secondes
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  // Manual import retry handler
  const handleManualImportRetry = async () => {
    toast.info("🚀 Relance des imports en attente...");
    
    const { data, error } = await supabase.functions.invoke('retry-pending-import-jobs');
    
    if (error) {
      toast.error(`❌ Erreur : ${error.message}`);
      console.error('Retry error:', error);
      return;
    }
    
    const processed = data?.processed || 0;
    const results = data?.results || [];
    
    console.log('Retry results:', data);
    
    if (processed > 0) {
      toast.success(`✅ ${processed} import(s) relancé(s) avec succès`);
      refetchImportJobs();
      refetchSuppliers();
    } else {
      toast.info("ℹ️ Aucun import en attente à relancer");
    }
  };

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
      // Fetch suppliers
      const { data: supplierData, error: supplierError } = await supabase
        .from("supplier_configurations")
        .select("*")
        .order("created_at", { ascending: false });

      if (supplierError) throw supplierError;
      if (!supplierData) return [];

      // Fetch product counts for each supplier
      const suppliersWithCounts = await Promise.all(
        supplierData.map(async (supplier) => {
          const { count, error: countError } = await supabase
            .from("supplier_products")
            .select("id", { count: "exact", head: true })
            .eq("supplier_id", supplier.id);

          console.log(`Supplier ${supplier.supplier_name}: ${count || 0} products`);

          return {
            ...supplier,
            product_count: count || 0
          };
        })
      );

      return suppliersWithCounts;
    },
  });

  const { data: imapStats } = useQuery({
    queryKey: ["imap-email-stats"],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { count, error } = await supabase
        .from("email_inbox")
        .select("id", { count: "exact", head: true })
        .eq("detection_method", "imap_polling")
        .gte("received_at", yesterday.toISOString());

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60000,
  });

  // Statistiques fournisseurs
  // Query for import jobs
  const { data: importJobs, refetch: refetchImportJobs } = useQuery({
    queryKey: ['import-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*, supplier_configurations(supplier_name)')
        .order('started_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Running imports
  const runningJobs = importJobs?.filter(job => 
    job.status === 'pending' || job.status === 'running'
  );

  const { data: stats } = useQuery({
    queryKey: ['supplier-stats'],
    queryFn: async () => {
      const { data: suppliers } = await supabase
        .from('supplier_configurations')
        .select('id, supplier_type, is_active');
      
      const { data: products } = await supabase
        .from('supplier_products')
        .select('id, enrichment_status');
      
      const enrichedCount = products?.filter(p => p.enrichment_status === 'completed').length || 0;
      const pendingCount = products?.filter(p => p.enrichment_status === 'pending').length || 0;
      const totalProducts = products?.length || 0;
      
      return {
        total_suppliers: suppliers?.length || 0,
        active_suppliers: suppliers?.filter(s => s.is_active).length || 0,
        total_products: totalProducts,
        pending_enrichment: pendingCount,
        enriched_products: enrichedCount,
        enrichment_percentage: totalProducts > 0 ? Math.round((enrichedCount / totalProducts) * 100) : 0,
      };
    },
  });

  // Realtime listener for import_jobs
  useEffect(() => {
    const channel = supabase
      .channel('import-jobs-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'import_jobs'
      }, (payload) => {
        console.log('Import job updated:', payload);
        refetchImportJobs();
        refetchSuppliers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

    if (supplier.supplier_type === 'file') {
      toast.error("❌ Les fournisseurs de type 'Fichier' ne peuvent pas être synchronisés automatiquement.");
      return;
    }

    try {
      // Use background sync for FTP/SFTP
      if (supplier.supplier_type === 'ftp' || supplier.supplier_type === 'sftp') {
        const { data, error } = await supabase.functions.invoke('supplier-sync-background', {
          body: { supplierId },
        });

        if (error) throw error;

        toast.success("✅ Import démarré en arrière-plan", {
          description: `${supplier.product_count || 0} produits en cours d'import`,
          action: {
            label: "Voir la progression",
            onClick: () => {
              const tabsList = document.querySelector('[role="tablist"]');
              const importsTab = Array.from(tabsList?.querySelectorAll('[role="tab"]') || [])
                .find(tab => tab.textContent?.includes('Imports'));
              (importsTab as HTMLElement)?.click();
            }
          },
          duration: 10000
        });
      } else {
        // Other types use direct sync
        let functionName = '';
        let bodyParams = {};
        
        if (supplier.supplier_type === 'api') {
          functionName = 'supplier-sync-api';
          bodyParams = { supplierId };
        } else if (supplier.supplier_type === 'odoo') {
          functionName = 'import-from-odoo';
          bodyParams = { supplier_id: supplierId };
        } else {
          toast.error("Type de synchronisation non supporté");
          return;
        }

        toast.info("Synchronisation en cours...");
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: bodyParams,
        });

        if (error) throw error;

        if (data?.warning) {
          toast.error(data.message || "⚠️ Configuration incomplète");
        } else if (data?.found !== undefined) {
          toast.success(`✅ Sync: ${data.found} trouvés | ${data.imported} importés | ${data.matched} matchés`);
        } else {
          toast.success(`✅ Synchronisation terminée`);
        }
      }
      
      refetchSuppliers();
      refetchImportJobs();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error("Erreur lors de la synchronisation");
    }
  };

  const handleEdit = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setShowNewSupplier(true);
  };

  const handleDeleteClick = (supplierId: string) => {
    setSupplierToDelete(supplierId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!supplierToDelete) return;

    try {
      // 1. Get all supplier products
      const { data: supplierProducts } = await supabase
        .from('supplier_products')
        .select('id')
        .eq('supplier_id', supplierToDelete);
      
      if (supplierProducts && supplierProducts.length > 0) {
        // 2. Delete product_links first
        const { error: linksError } = await supabase
          .from('product_links')
          .delete()
          .in('supplier_product_id', supplierProducts.map(p => p.id));
        
        if (linksError) {
          console.error('Error deleting product links:', linksError);
        }
      }

      // 3. Delete email inbox entries
      const { error: emailError } = await supabase
        .from('email_inbox')
        .delete()
        .eq('supplier_id', supplierToDelete);
      
      if (emailError) {
        console.error('Error deleting emails:', emailError);
      }

      // 4. Delete supplier products
      const { error: productsError } = await supabase
        .from('supplier_products')
        .delete()
        .eq('supplier_id', supplierToDelete);

      if (productsError) throw productsError;

      // 5. Delete supplier configuration
      const { error: supplierError } = await supabase
        .from('supplier_configurations')
        .delete()
        .eq('id', supplierToDelete);

      if (supplierError) throw supplierError;

      toast.success("✅ Fournisseur supprimé avec succès");
      refetchSuppliers();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("❌ Erreur lors de la suppression");
    } finally {
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    }
  };

  // Bulk selection handlers
  const toggleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierIds(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const toggleAllSuppliers = () => {
    if (selectedSupplierIds.length === suppliers?.length) {
      setSelectedSupplierIds([]);
    } else {
      setSelectedSupplierIds(suppliers?.map(s => s.id) || []);
    }
  };

  // Calculate total products to delete
  const calculateTotalProducts = async (supplierIds: string[]) => {
    try {
      const { count } = await supabase
        .from('supplier_products')
        .select('id', { count: 'exact', head: true })
        .in('supplier_id', supplierIds);
      
      return count || 0;
    } catch (error) {
      console.error('Error calculating products:', error);
      return 0;
    }
  };

  const handleBulkDeleteClick = async () => {
    if (selectedSupplierIds.length === 0) return;
    
    const totalProducts = await calculateTotalProducts(selectedSupplierIds);
    setTotalProductsToDelete(totalProducts);
    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedSupplierIds.length === 0) return;
    
    setIsBulkDeleting(true);
    setBulkDeleteProgress({ current: 0, total: selectedSupplierIds.length });
    
    const results = {
      success: [] as string[],
      failed: [] as { id: string; name: string; error: string }[]
    };

    for (let i = 0; i < selectedSupplierIds.length; i++) {
      const supplierId = selectedSupplierIds[i];
      setBulkDeleteProgress({ current: i + 1, total: selectedSupplierIds.length });
      
      try {
        // Get supplier name for error reporting
        const { data: supplierData } = await supabase
          .from('supplier_configurations')
          .select('supplier_name')
          .eq('id', supplierId)
          .single();
        
        const supplierName = supplierData?.supplier_name || 'Inconnu';

        // 1. Get all supplier products
        const { data: supplierProducts } = await supabase
          .from('supplier_products')
          .select('id')
          .eq('supplier_id', supplierId);
        
        if (supplierProducts && supplierProducts.length > 0) {
          // 2. Delete product_links first
          const { error: linksError } = await supabase
            .from('product_links')
            .delete()
            .in('supplier_product_id', supplierProducts.map(p => p.id));
          
          if (linksError) {
            console.error(`Error deleting links for ${supplierName}:`, linksError);
          }
        }

        // 3. Delete email inbox entries
        const { error: emailError } = await supabase
          .from('email_inbox')
          .delete()
          .eq('supplier_id', supplierId);
        
        if (emailError) {
          console.error(`Error deleting emails for ${supplierName}:`, emailError);
        }

        // 4. Delete supplier products
        const { error: productsError } = await supabase
          .from('supplier_products')
          .delete()
          .eq('supplier_id', supplierId);

        if (productsError) throw productsError;

        // 5. Delete supplier configuration
        const { error: supplierError } = await supabase
          .from('supplier_configurations')
          .delete()
          .eq('id', supplierId);

        if (supplierError) throw supplierError;

        results.success.push(supplierName);
      } catch (error: any) {
        console.error(`Failed to delete supplier ${supplierId}:`, error);
        const supplierName = suppliers?.find(s => s.id === supplierId)?.supplier_name || 'Inconnu';
        results.failed.push({
          id: supplierId,
          name: supplierName,
          error: error.message || 'Erreur inconnue'
        });
      }
    }

    // Show results
    if (results.success.length > 0) {
      toast.success(`✅ ${results.success.length} fournisseur(s) supprimé(s) avec succès`);
    }
    
    if (results.failed.length > 0) {
      toast.error(`❌ ${results.failed.length} fournisseur(s) n'ont pas pu être supprimés`, {
        description: results.failed.map(f => `${f.name}: ${f.error}`).join('\n')
      });
    }

    setIsBulkDeleting(false);
    setBulkDeleteDialogOpen(false);
    setSelectedSupplierIds([]);
    refetchSuppliers();
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
          <Button
            variant="outline"
            onClick={handleManualImportRetry}
          >
            🚀 Relancer imports
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const tabsList = document.querySelector('[role="tablist"]');
              const templatesTab = Array.from(tabsList?.querySelectorAll('[role="tab"]') || [])
                .find(tab => tab.textContent?.includes('Templates'));
              (templatesTab as HTMLElement)?.click();
            }}
          >
            📋 Templates de mapping
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const tabsList = document.querySelector('[role="tablist"]');
              const linksTab = Array.from(tabsList?.querySelectorAll('[role="tab"]') || [])
                .find(tab => tab.textContent?.includes('Produits'));
              (linksTab as HTMLElement)?.click();
            }}
          >
            🔗 Produits liés
          </Button>
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

      {/* Statistiques consolidées */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <div className="text-3xl font-bold">{stats?.total_suppliers || 0}</div>
                <p className="text-sm text-muted-foreground">Fournisseurs</p>
                <div className="mt-2">
                  <Progress value={stats?.total_suppliers ? (stats.active_suppliers / stats.total_suppliers) * 100 : 0} className="h-1" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.active_suppliers || 0} actifs ({stats?.total_suppliers ? Math.round((stats.active_suppliers / stats.total_suppliers) * 100) : 0}%)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-green-600" />
              <div className="flex-1">
                <div className="text-3xl font-bold text-green-600">{stats?.total_products || 0}</div>
                <p className="text-sm text-muted-foreground">Produits importés</p>
                <div className="mt-2">
                  <Progress value={stats?.enrichment_percentage || 0} className="h-1" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.enrichment_percentage || 0}% enrichis
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-600" />
              <div className="flex-1">
                <div className="text-3xl font-bold text-blue-600">{imapStats || 0}</div>
                <p className="text-sm text-muted-foreground">Emails (24h)</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Reçus via IMAP/POP3
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {runningJobs && runningJobs.length > 0 ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
                  <div className="flex-1">
                    <div className="text-3xl font-bold text-orange-600">{runningJobs.length}</div>
                    <p className="text-sm text-muted-foreground">Imports actifs</p>
                    <div className="mt-2">
                      <Progress 
                        value={runningJobs[0]?.progress_total > 0 ? (runningJobs[0].progress_current / runningJobs[0].progress_total) * 100 : 0} 
                        className="h-1" 
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.pending_enrichment || 0} en attente enrichissement
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-3xl font-bold">0</div>
                    <p className="text-sm text-muted-foreground">Imports actifs</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {stats?.pending_enrichment || 0} en attente enrichissement
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard de synchronisation */}
      <SupplierSyncHealth />
      
      {/* Panel de logs en direct */}
      <SupplierLogsPanel />

      {/* Alertes système */}
      <div className="space-y-3">
        {suppliers?.some(s => {
          const isFtpType = s.supplier_type === 'ftp' || s.supplier_type === 'sftp';
          const config = s.connection_config as any;
          const hasConnection = config && config.host && config.port;
          return isFtpType && !hasConnection;
        }) && (
          <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              ⚠️ Vous avez des fournisseurs FTP/SFTP non configurés. Vérifiez que l'hôte et le port sont correctement renseignés dans la configuration.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Tabs defaultValue="list" className="w-full">
        <div className="space-y-2">
          {/* Ligne 1 - Gestion principale (6 onglets) */}
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="list">📦 Fournisseurs</TabsTrigger>
            <TabsTrigger value="products">🛍️ Produits</TabsTrigger>
            <TabsTrigger value="mapping-setup">🗺️ Mapping</TabsTrigger>
            <TabsTrigger value="inbox">📧 Inbox</TabsTrigger>
            <TabsTrigger value="email-setup">⚙️ Email</TabsTrigger>
            <TabsTrigger value="platforms">🔑 Plateformes</TabsTrigger>
          </TabsList>
          
          {/* Ligne 2 - Monitoring & Historique (6 onglets) */}
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="imports">
              📊 Imports Live
              {runningJobs && runningJobs.length > 0 && (
                <Badge variant="secondary" className="ml-2 animate-pulse">
                  {runningJobs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs">📈 Historique</TabsTrigger>
            <TabsTrigger value="scheduler">⏰ Planning</TabsTrigger>
            <TabsTrigger value="automation">🤖 Automatisations</TabsTrigger>
            <TabsTrigger value="monitoring">📡 Monitoring</TabsTrigger>
            <TabsTrigger value="templates">📋 Templates</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedSupplierIds.length === suppliers?.length && suppliers?.length > 0}
                        onCheckedChange={toggleAllSuppliers}
                      />
                    </TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dernière synchro</TableHead>
                    <TableHead>Produits</TableHead>
                    <TableHead>Progression</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers?.map((supplier) => (
                  <TableRow 
                    key={supplier.id}
                    className={selectedSupplierIds.includes(supplier.id) ? "bg-accent/50" : ""}
                  >
                      <TableCell>
                        <Checkbox
                          checked={selectedSupplierIds.includes(supplier.id)}
                          onCheckedChange={() => toggleSupplierSelection(supplier.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{supplier.supplier_name}</span>
                          </div>
                          {/* FTP Configuration Status */}
                          {(supplier.supplier_type === 'ftp' || supplier.supplier_type === 'sftp') && (
                            <div className="ml-6">
                              {supplier.column_mapping ? (
                                <Badge variant="outline" className="text-xs border-green-500 text-green-700 dark:text-green-400">
                                  ✅ Mapping configuré
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs border-orange-500 text-orange-700 dark:text-orange-400">
                                  ⚠️ Mapping requis
                                </Badge>
                              )}
                            </div>
                           )}
                           {/* Running import indicator */}
                           {runningJobs?.some(job => job.supplier_id === supplier.id) && (
                             <Badge variant="outline" className="ml-6 animate-pulse border-blue-500 text-blue-700 dark:text-blue-400">
                               <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                               Import en cours... {runningJobs.find(j => j.supplier_id === supplier.id)?.progress_current || 0} / {runningJobs.find(j => j.supplier_id === supplier.id)?.progress_total || 0}
                             </Badge>
                           )}
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
                      <TableCell>
                        <SupplierProgressCell supplierId={supplier.id} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {/* Mapping Wizard Button - For all suppliers */}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSelectedSupplierId(supplier.id);
                              setSelectedSupplierName(supplier.supplier_name);
                              setSelectedSupplierType(supplier.supplier_type as any || 'file');
                              setShowMappingWizard(true);
                            }}
                          >
                            🗺️ Mapping
                          </Button>
                          
                          {/* FTP Mapping Button */}
                          {(supplier.supplier_type === 'ftp' || supplier.supplier_type === 'sftp') && !supplier.column_mapping && (
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => {
                                setSelectedSupplierId(supplier.id);
                                setShowFTPWizard(true);
                              }}
                            >
                              🔧 Configurer FTP
                            </Button>
                          )}
                          
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
                              disabled={(supplier.supplier_type === 'ftp' || supplier.supplier_type === 'sftp') && !supplier.column_mapping}
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
                          
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteClick(supplier.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
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

        <TabsContent value="linked">
          <SupplierProductLinksTab />
        </TabsContent>

        <TabsContent value="mapping-setup">
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Sélectionnez un fournisseur ci-dessous pour configurer ou visualiser son mapping de colonnes.
              </AlertDescription>
            </Alert>
            
            <Card>
              <CardHeader>
                <CardTitle>Sélectionner un fournisseur</CardTitle>
                <CardDescription>
                  Choisissez le fournisseur pour lequel vous souhaitez gérer le mapping
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  {suppliers?.map((supplier) => (
                    <Button
                      key={supplier.id}
                      variant="outline"
                      className="justify-start h-auto p-4"
                      onClick={() => setSelectedSupplierId(supplier.id)}
                    >
                      <div className="flex flex-col items-start gap-1 w-full">
                        <div className="font-semibold">{supplier.supplier_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Type: {supplierTypeLabels[supplier.supplier_type]}
                        </div>
                        {supplier.column_mapping ? (
                          <Badge variant="default" className="mt-1">
                            ✅ Mapping configuré
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="mt-1">
                            ⚠️ À configurer
                          </Badge>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedSupplierId && (
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    📋 État du mapping
                  </TabsTrigger>
                  <TabsTrigger value="setup">⚙️ Configurer mapping</TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="mt-6">
                  <SupplierMappingPreview supplierId={selectedSupplierId} />
                </TabsContent>

                <TabsContent value="setup" className="mt-6">
                  <SupplierMappingSetup supplierId={selectedSupplierId} />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </TabsContent>

        <TabsContent value="inbox">
          <div className="space-y-4">
            {/* Poll Monitoring Dashboard */}
            <Card>
              <CardHeader>
                <CardTitle>📊 Monitoring IMAP/POP3</CardTitle>
                <CardDescription>
                  Statut des vérifications automatiques des boîtes email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmailPollMonitoring />
              </CardContent>
            </Card>
            
            {/* Manual email check button */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Actions manuelles</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={handleManualEmailPoll} className="w-full">
                  <Mail className="h-4 w-4 mr-2" />
                  🔄 Vérifier les emails maintenant
                </Button>
              </CardContent>
            </Card>

            {/* Email inbox table */}
            <EmailInboxTable />
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <UserAlerts />
        </TabsContent>

        <TabsContent value="email-setup">
          <EmailSetupGuide />
        </TabsContent>

        <TabsContent value="platforms" className="space-y-6">
          <PlatformSettings />
        </TabsContent>

        <TabsContent value="imports" className="space-y-4">
          <LiveImportProgress />
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

        <TabsContent value="scheduler">
          <ImportScheduler />
        </TabsContent>

        <TabsContent value="automation">
          <AutomationMasterManager />
        </TabsContent>

        <TabsContent value="monitoring">
          <AutomationMonitoringDashboard />
        </TabsContent>

        <TabsContent value="templates">
          <MappingTemplatesManager />
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

      {showFTPWizard && selectedSupplierId && (
        <FTPMappingWizard
          supplierId={selectedSupplierId}
          open={showFTPWizard}
          onClose={() => {
            setShowFTPWizard(false);
            setSelectedSupplierId(null);
          }}
          onComplete={() => {
            refetchSuppliers();
            setShowFTPWizard(false);
            setSelectedSupplierId(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🗑️ Supprimer le fournisseur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tous les produits associés à ce fournisseur seront également supprimés.
              Êtes-vous sûr de vouloir continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🗑️ Supprimer {selectedSupplierIds.length} fournisseur(s) ?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-foreground">Cette action supprimera :</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{selectedSupplierIds.length} fournisseur(s)</li>
                <li>{totalProductsToDelete} produit(s) associé(s)</li>
                <li>Tous les liens et historiques</li>
              </ul>
              <p className="text-destructive font-semibold mt-4">⚠️ Cette action est irréversible !</p>
              
              {isBulkDeleting && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progression :</span>
                    <span className="font-semibold">{bulkDeleteProgress.current} / {bulkDeleteProgress.total}</span>
                  </div>
                  <Progress value={(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100} />
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression en cours...
                </>
              ) : (
                'Supprimer définitivement'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Bar */}
      {selectedSupplierIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <Card className="shadow-2xl border-2">
            <CardContent className="flex items-center gap-4 p-4">
              <Badge variant="secondary" className="text-base px-4 py-2">
                {selectedSupplierIds.length} fournisseur(s) sélectionné(s)
              </Badge>
              <Button 
                variant="destructive" 
                onClick={handleBulkDeleteClick}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer la sélection
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSelectedSupplierIds([])}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Annuler
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unified Mapping Wizard Dialog */}
      {showMappingWizard && selectedSupplierId && (
        <UnifiedMappingDialog
          open={showMappingWizard}
          onOpenChange={setShowMappingWizard}
          supplierId={selectedSupplierId}
          supplierName={selectedSupplierName}
          sourceType={selectedSupplierType}
        />
      )}
    </div>
  );
}

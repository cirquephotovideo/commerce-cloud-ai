import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, RefreshCw, Mail, Eye, TrendingUp, Trash2, Download, Package, FileCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { EmailDetailModal } from "./EmailDetailModal";
import { EmailMappingDialog } from "./EmailMappingDialog";
import { ImportProgressDialog } from "./ImportProgressDialog";
import { EmailMappingValidation } from "./EmailMappingValidation";
import { detectHeaderRow, normalizeHeader, suggestMapping } from "@/lib/detectHeaderRow";
import * as XLSX from "xlsx";

export function EmailInboxTable() {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [mappingEmail, setMappingEmail] = useState<any>(null);
  const [currentInboxId, setCurrentInboxId] = useState<string | null>(null);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [importProgress, setImportProgress] = useState<{
    open: boolean;
    total: number;
    processed: number;
    success: number;
    skipped: number;
    errors: number;
    current_operation: string;
    processingLogs?: any[];
  }>({
    open: false,
    total: 0,
    processed: 0,
    success: 0,
    skipped: 0,
    errors: 0,
    current_operation: '',
    processingLogs: []
  });

  const [mappingValidation, setMappingValidation] = useState<{
    email: any;
    columns: string[];
    previewData: any[];
    suggestedMapping: any;
    totalRows: number;
  } | null>(null);
  
  const { data: emailInbox, refetch, isRefetching } = useQuery({
    queryKey: ['email-inbox', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('email_inbox')
        .select('*, supplier_configurations(supplier_name)')
        .order('received_at', { ascending: false })
        .limit(50);
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setLastUpdate(new Date());
      return data;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  // Group emails by supplier
  const emailsBySupplier = useMemo(() => {
    if (!emailInbox) return {};
    
    const grouped = emailInbox.reduce((acc, email) => {
      const supplierName = email.detected_supplier_name || 'Fournisseur inconnu';
      if (!acc[supplierName]) {
        acc[supplierName] = [];
      }
      acc[supplierName].push(email);
      return acc;
    }, {} as Record<string, typeof emailInbox>);

    // Sort each group by date (most recent first)
    Object.values(grouped).forEach(emails => {
      emails.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    });

    return grouped;
  }, [emailInbox]);

  const handleManualRefresh = () => {
    refetch();
    toast.info("Actualisation en cours...");
  };

  // Real-time updates with polling fallback
  useEffect(() => {
    if (!currentInboxId) return;

    let realtimeReceived = false;
    
    const updateProgressFromInbox = (inbox: any) => {
      const logs = inbox.processing_logs as any[];
      const progressLog = logs?.find((log: any) => log.type === 'progress');
      const jobIdLog = logs?.find((log: any) => log.job_id);
      const jobId = jobIdLog?.job_id;

      // If job created, track job progress instead
      if (jobId && inbox.status === 'queued') {
        // Switch to tracking import_jobs
        const fetchJobProgress = async () => {
          const { data: job } = await supabase
            .from('import_jobs')
            .select('*')
            .eq('id', jobId)
            .maybeSingle();

          if (job) {
            setImportProgress(prev => ({
              ...prev,
              open: true,
              total: job.progress_total || prev.total,
              processed: job.progress_current || 0,
              success: job.products_imported || 0,
              skipped: 0,
              errors: job.products_errors || 0,
              current_operation: job.status === 'queued' 
                ? 'En file d\'attente...' 
                : `Import en cours (${job.progress_current || 0}/${job.progress_total || 0})`,
              processingLogs: logs || []
            }));

            if (job.status === 'completed' || job.status === 'failed') {
              if (pollingIntervalId) {
                clearInterval(pollingIntervalId);
                setPollingIntervalId(null);
              }
              setCurrentInboxId(null);

              if (job.products_imported === 0 && job.status === 'completed') {
                toast.error("⚠️ Import terminé mais aucun produit traité - Vérifiez le mapping");
                setTimeout(() => {
                  setImportProgress(prev => ({ ...prev, open: false }));
                  refetch();
                }, 5000);
              } else {
                toast.success(`Import terminé: ${job.products_imported} produit(s) importé(s)`);
                setTimeout(() => {
                  setImportProgress(prev => ({ ...prev, open: false }));
                  refetch();
                }, 2000);
              }
            }
          }
        };

        // Poll job progress
        fetchJobProgress();
        const jobPolling = setInterval(fetchJobProgress, 2000);
        setPollingIntervalId(jobPolling);
        return;
      }
      
      if (progressLog) {
        setImportProgress(prev => ({
          ...prev,
          open: inbox.status === 'processing',
          total: progressLog.total || prev.total,
          processed: progressLog.processed || 0,
          success: progressLog.success ?? prev.success,
          skipped: progressLog.skipped || 0,
          errors: progressLog.errors || 0,
          current_operation: progressLog.message || 'Traitement en cours...',
          processingLogs: logs || []
        }));

        // Close and refresh when done
        if (inbox.status === 'completed' || inbox.status === 'failed') {
          if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            setPollingIntervalId(null);
          }
          setCurrentInboxId(null);
          
          // Check if 0 products were processed
          const hasNoProducts = (progressLog.success ?? 0) === 0 && (inbox.products_created ?? 0) === 0 && (inbox.products_updated ?? 0) === 0;
          
          if (hasNoProducts && inbox.status === 'completed') {
            toast.error("⚠️ Import terminé mais aucun produit traité - Le fichier semble mal formaté");
            // Keep modal open for user to see errors
            setTimeout(() => {
              setImportProgress(prev => ({ ...prev, open: false }));
              refetch();
            }, 5000);
          } else {
            setTimeout(() => {
              setImportProgress(prev => ({ ...prev, open: false }));
              refetch();
            }, 2000);
          }
        }
      }
    };
    
    const channel = supabase
      .channel('email-inbox-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_inbox',
          filter: `id=eq.${currentInboxId}`
        },
        (payload) => {
          realtimeReceived = true;
          console.log('[EmailInboxTable] Realtime update:', payload.new);
          
          // Stop polling if realtime works
          if (pollingIntervalId) {
            clearInterval(pollingIntervalId);
            setPollingIntervalId(null);
          }
          
          updateProgressFromInbox(payload.new);
        }
      )
      .subscribe();

    // Fallback polling every 2s
    const pollInterval = setInterval(async () => {
      if (realtimeReceived) return;
      
      const { data: inbox } = await supabase
        .from('email_inbox')
        .select('*')
        .eq('id', currentInboxId)
        .maybeSingle();
        
      if (inbox) {
        console.log('[EmailInboxTable] Polling update:', inbox);
        updateProgressFromInbox(inbox);
      }
    }, 2000);
    
    setPollingIntervalId(pollInterval);

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentInboxId, refetch]);

  const handleReprocess = async (inboxId: string) => {
    try {
      const email = emailInbox?.find(e => e.id === inboxId);
      if (!email?.attachment_url) {
        toast.error("Fichier introuvable");
        return;
      }

      toast.info("Chargement du fichier pour validation...");

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('email-attachments')
        .download(email.attachment_url);

      if (downloadError || !fileData) {
        toast.error("Impossible de charger le fichier");
        return;
      }

      // Parse file
      const arrayBuffer = await fileData.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      // Load supplier configuration for skip_rows and existing mapping
      let skipRowsConfig = 0;
      let existingMapping: Record<string, number | null> = {};
      
      if (email.supplier_id) {
        const { data: supplier, error: supplierError } = await supabase
          .from('supplier_configurations')
          .select('column_mapping, skip_rows')
          .eq('id', email.supplier_id)
          .maybeSingle();

        if (!supplierError && supplier) {
          skipRowsConfig = supplier.skip_rows || 0;
          existingMapping = (supplier.column_mapping as Record<string, number | null>) || {};
        }
      }

      // Detect header row using skip_rows or auto-detection
      const headerRowIndex = skipRowsConfig > 0 ? skipRowsConfig : detectHeaderRow(rawRows);
      const headers = (rawRows[headerRowIndex] || []).map((h: any, i: number) => 
        normalizeHeader(h) || `Col ${i}`
      );
      const dataRows = rawRows.slice(headerRowIndex + 1);

      console.log(`[handleReprocess] Headers detected at row ${headerRowIndex + 1}:`, headers);

      // Build preview data
      const preview = dataRows.slice(0, 5).map(row => {
        const obj: any = {};
        headers.forEach((h: string, i: number) => obj[h] = (row as any)[i]);
        return obj;
      });

      // Suggest mapping if no existing mapping
      let suggestedMapping = existingMapping;
      if (Object.keys(existingMapping).length === 0 || Object.values(existingMapping).every(v => v === null)) {
        suggestedMapping = suggestMapping(headers);
        console.log('[handleReprocess] Auto-suggested mapping:', suggestedMapping);
      }

      // Open validation modal
      setMappingValidation({
        email,
        columns: headers,
        previewData: [headers, ...preview],
        suggestedMapping,
        totalRows: dataRows.length
      });

      if (headerRowIndex > 0) {
        toast.success(`En-têtes détectés à la ligne ${headerRowIndex + 1}`, {
          description: `${headers.length} colonnes trouvées`
        });
      }

    } catch (error) {
      console.error('Error preparing reprocess:', error);
      toast.error("Erreur lors du chargement du fichier");
    }
  };

  const handleConfirmMapping = async (confirmedMapping: Record<string, number | null>) => {
    if (!mappingValidation) return;

    console.log('[EmailInboxTable] Confirming mapping:', confirmedMapping);

    // Convert column indices to column names for backend
    const nameMapping = Object.fromEntries(
      Object.entries(confirmedMapping).map(([key, idx]) => [
        key,
        idx === null ? null : mappingValidation.columns[idx]
      ])
    );

    console.log('[EmailInboxTable] Name mapping:', nameMapping);

    // Initialize progress dialog with realistic total
    setImportProgress({
      open: true,
      total: mappingValidation.totalRows,
      processed: 0,
      success: 0,
      skipped: 0,
      errors: 0,
      current_operation: "Initialisation de l'import..."
    });

    // Store current inbox ID for realtime updates
    setCurrentInboxId(mappingValidation.email.id);

    try {
      const { error } = await supabase.functions.invoke('process-email-attachment', {
        body: {
          inbox_id: mappingValidation.email.id,
          user_id: mappingValidation.email.user_id,
          custom_mapping: nameMapping
        }
      });

      if (error) throw error;

      toast.success('Import lancé');
      setMappingValidation(null);
    } catch (error: any) {
      console.error('[EmailInboxTable] Error confirming mapping:', error);
      setCurrentInboxId(null);
      setImportProgress(prev => ({ ...prev, open: false }));
      toast.error(error.message || "Erreur lors du lancement de l'import");
    }
  };

  const handleDownload = async (email: any) => {
    if (!email.attachment_url) return;
    
    try {
      const link = document.createElement('a');
      link.href = email.attachment_url;
      link.download = email.attachment_name || 'attachment';
      link.click();
      toast.success("Téléchargement lancé");
    } catch (error) {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleDelete = async (inboxId: string) => {
    if (!confirm("Supprimer cet email ?")) return;
    
    try {
      const { error } = await supabase
        .from('email_inbox')
        .delete()
        .eq('id', inboxId);
      
      if (error) throw error;
      toast.success("Email supprimé");
      refetch();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleBulkReprocess = async (supplierName: string) => {
    const emails = emailsBySupplier[supplierName]?.filter(e => e.status === 'failed');
    if (!emails?.length) {
      toast.info("Aucun email en erreur à retraiter");
      return;
    }
    
    if (!confirm(`Retraiter ${emails.length} email(s) en erreur de ${supplierName} ?`)) return;
    
    try {
      toast.info(`Retraitement de ${emails.length} email(s)...`);
      
      for (const email of emails) {
        await handleReprocess(email.id);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      toast.success("Retraitement en masse terminé");
    } catch (error) {
      toast.error("Erreur lors du retraitement en masse");
    }
  };

  const handleBulkDelete = async (supplierName: string) => {
    const emails = emailsBySupplier[supplierName];
    if (!emails?.length) return;
    
    if (!confirm(`Supprimer tous les ${emails.length} email(s) de ${supplierName} ?`)) return;
    
    try {
      const { error } = await supabase
        .from('email_inbox')
        .delete()
        .in('id', emails.map(e => e.id));
      
      if (error) throw error;
      
      toast.success(`${emails.length} email(s) supprimé(s)`);
      refetch();
    } catch (error) {
      toast.error("Erreur lors de la suppression en masse");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; }> = {
      pending: { variant: "secondary", label: "En attente" },
      processing: { variant: "default", label: "En traitement" },
      completed: { variant: "default", label: "Terminé" },
      failed: { variant: "destructive", label: "Erreur" },
      ignored: { variant: "outline", label: "Ignoré" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Stats
  const stats = {
    total: emailInbox?.length || 0,
    completed: emailInbox?.filter(e => e.status === 'completed').length || 0,
    pending: emailInbox?.filter(e => e.status === 'pending').length || 0,
    failed: emailInbox?.filter(e => e.status === 'failed').length || 0
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Emails reçus
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Dernière actualisation : {formatDistanceToNow(lastUpdate, { locale: fr, addSuffix: true })}
                · Auto-refresh toutes les 30s
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefetching}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Emails totaux</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">Traités</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">Erreurs</p>
            </CardContent>
          </Card>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button 
            variant={statusFilter === 'all' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setStatusFilter('all')}
          >
            Tous
          </Button>
          <Button 
            variant={statusFilter === 'pending' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setStatusFilter('pending')}
          >
            En attente
          </Button>
          <Button 
            variant={statusFilter === 'processing' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setStatusFilter('processing')}
          >
            En traitement
          </Button>
          <Button 
            variant={statusFilter === 'completed' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setStatusFilter('completed')}
          >
            Terminé
          </Button>
          <Button 
            variant={statusFilter === 'failed' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setStatusFilter('failed')}
          >
            Erreur
          </Button>
          <Button 
            variant={statusFilter === 'ignored' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setStatusFilter('ignored')}
          >
            Ignoré
          </Button>
        </div>

        {!emailInbox || emailInbox.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>
              {statusFilter === 'all' 
                ? "Aucun email reçu. Cliquez sur 'Vérifier maintenant' pour récupérer les emails." 
                : `Aucun email avec le statut "${statusFilter === 'pending' ? 'en attente' : statusFilter === 'processing' ? 'en traitement' : statusFilter === 'completed' ? 'terminé' : statusFilter === 'failed' ? 'erreur' : 'ignoré'}"`}
            </p>
            {statusFilter === 'all' && (
              <p className="text-sm mt-2">
                Configurez un fournisseur de type "Email" pour commencer à recevoir des tarifs automatiquement
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(emailsBySupplier).map(([supplierName, emails]) => (
              <div key={supplierName} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {supplierName}
                    <Badge variant="outline">{emails.length} email(s)</Badge>
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>✅ {emails.filter(e => e.status === 'completed').length} traités</span>
                      <span>⏳ {emails.filter(e => e.status === 'pending').length} en attente</span>
                      <span>❌ {emails.filter(e => e.status === 'failed').length} erreurs</span>
                    </div>
                    <div className="flex gap-2">
                      {emails.filter(e => e.status === 'failed').length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleBulkReprocess(supplierName)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Tout retraiter ({emails.filter(e => e.status === 'failed').length})
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleBulkDelete(supplierName)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Tout supprimer
                      </Button>
                    </div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reçu le</TableHead>
                      <TableHead>Expéditeur</TableHead>
                      <TableHead>Fichier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions effectuées</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Logs</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.map((email) => (
                      <TableRow key={email.id}>
                        <TableCell className="text-sm">
                          {formatDistanceToNow(new Date(email.received_at), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{email.from_name || 'Sans nom'}</div>
                            <div className="text-xs text-muted-foreground">{email.from_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{email.attachment_name || 'N/A'}</span>
                          </div>
                          {email.attachment_size_kb && (
                            <div className="text-xs text-muted-foreground">
                              {email.attachment_size_kb} KB
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            ['csv', 'xlsx', 'xls'].includes(email.attachment_type || '') ? 'default' :
                            email.attachment_type === 'zip' ? 'secondary' :
                            'outline'
                          }>
                            {email.attachment_type?.toUpperCase() || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {email.products_created > 0 && (
                              <Badge variant="default" className="text-xs">
                                ✅ {email.products_created} créés
                              </Badge>
                            )}
                            {email.products_updated > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                🔄 {email.products_updated} màj
                              </Badge>
                            )}
                            {email.status === 'completed' && !email.products_created && !email.products_updated && (
                              <Badge variant="outline" className="text-xs">
                                ✓ Traité
                              </Badge>
                            )}
                            {email.status === 'failed' && (
                              <Badge variant="destructive" className="text-xs">
                                ❌ Échec
                              </Badge>
                            )}
                            {email.status === 'pending' && (
                              <Badge variant="outline" className="text-xs">
                                ⏳ En attente
                              </Badge>
                            )}
                            {email.status === 'processing' && (
                              <Badge variant="default" className="text-xs animate-pulse">
                                ⚙️ En cours
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(email.status)}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Eye className="h-4 w-4 text-muted-foreground hover:text-primary cursor-pointer" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md max-h-96 overflow-y-auto">
                                <div className="space-y-1 text-xs">
                                  {(!email.processing_logs || !Array.isArray(email.processing_logs) || email.processing_logs.length === 0) ? (
                                    <div className="text-muted-foreground">Aucun log disponible</div>
                                  ) : (
                                    (email.processing_logs as any[]).map((log: any, i: number) => (
                                      <div key={i} className="flex gap-2 border-b pb-1">
                                        <span className="text-muted-foreground shrink-0">
                                          {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                                        </span>
                                        <span>{log.message}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {email.status === 'pending' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setMappingEmail(email)}
                                    >
                                      <FileCheck className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Valider le mapping avant traitement
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {email.attachment_url && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDownload(email)}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Télécharger</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedEmail(email)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Voir les détails</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {['pending', 'failed', 'completed'].includes(email.status) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleReprocess(email.id)}
                                      disabled={email.status === 'processing'}
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Retraiter</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {['completed', 'failed'].includes(email.status) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelete(email.id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Supprimer</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {selectedEmail && (
      <EmailDetailModal
        email={selectedEmail}
        open={!!selectedEmail}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
        onRefresh={refetch}
      />
    )}

    {mappingEmail && (
      <EmailMappingDialog
        email={mappingEmail}
        onClose={() => setMappingEmail(null)}
        onConfirm={() => {
          setMappingEmail(null);
          refetch();
        }}
      />
    )}

      <ImportProgressDialog
        open={importProgress.open}
        progress={importProgress}
        processingLogs={importProgress.processingLogs}
      />

      {mappingValidation && (
        <EmailMappingValidation
          email={mappingValidation.email}
          detectedColumns={mappingValidation.columns}
          previewData={mappingValidation.previewData}
          suggestedMapping={mappingValidation.suggestedMapping}
          onConfirm={handleConfirmMapping}
          onCancel={() => setMappingValidation(null)}
        />
      )}
    </>
  );
}

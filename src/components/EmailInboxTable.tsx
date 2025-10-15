import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, RefreshCw, Mail, Eye, TrendingUp, Trash2, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { EmailDetailModal } from "./EmailDetailModal";

export function EmailInboxTable() {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  
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

  const handleManualRefresh = () => {
    refetch();
    toast.info("Actualisation en cours...");
  };

  const handleReprocess = async (inboxId: string) => {
    try {
      toast.info("Retraitement en cours...");
      
      const { error } = await supabase.functions.invoke('process-email-attachment', {
        body: {
          inbox_id: inboxId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        },
      });

      if (error) throw error;
      
      toast.success("Retraitement lancé");
      refetch();
    } catch (error: any) {
      console.error('Reprocess error:', error);
      toast.error("Erreur lors du retraitement");
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reçu le</TableHead>
                <TableHead>Expéditeur</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Fichier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Produits</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Logs</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailInbox.map((email) => (
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
                      <span>{email.detected_supplier_name}</span>
                      {email.detection_confidence && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(email.detection_confidence)}%
                        </Badge>
                      )}
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
                    <div className="flex gap-1 flex-wrap">
                      {email.products_updated > 0 && (
                        <Badge variant="default" className="text-xs">
                          ✓ {email.products_updated}
                        </Badge>
                      )}
                      {email.products_created > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          + {email.products_created}
                        </Badge>
                      )}
                      {email.products_found > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {email.products_found} trouvés
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
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedEmail(email)}
                        title="Voir les détails"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReprocess(email.id)}
                        disabled={email.status === 'processing'}
                        title="Retraiter"
                      >
                        <RefreshCw className="h-4 w-4" />
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

    <EmailDetailModal
      email={selectedEmail}
      open={!!selectedEmail}
      onOpenChange={(open) => !open && setSelectedEmail(null)}
      onRefresh={refetch}
    />
    </>
  );
}

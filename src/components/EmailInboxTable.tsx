import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function EmailInboxTable() {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  const { data: emailInbox, refetch, isRefetching } = useQuery({
    queryKey: ['email-inbox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_inbox')
        .select('*, supplier_configurations(supplier_name)')
        .order('received_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setLastUpdate(new Date());
      return data;
    },
    refetchInterval: 30000, // 30 secondes
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

  return (
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
        {!emailInbox || emailInbox.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucun email reçu pour le moment</p>
            <p className="text-sm mt-2">
              Configurez un fournisseur de type "Email" pour commencer à recevoir des tarifs automatiquement
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reçu le</TableHead>
                <TableHead>Expéditeur</TableHead>
                <TableHead>Fournisseur détecté</TableHead>
                <TableHead>Fichier</TableHead>
                <TableHead>Produits</TableHead>
                <TableHead>Statut</TableHead>
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
                      <span className="text-sm">{email.attachment_name}</span>
                    </div>
                    {email.attachment_size_kb && (
                      <div className="text-xs text-muted-foreground">
                        {email.attachment_size_kb} KB
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReprocess(email.id)}
                      disabled={email.status === 'processing'}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

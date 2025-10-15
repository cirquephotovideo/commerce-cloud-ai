import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Mail, Calendar, FileText, AlertCircle, CheckCircle, RefreshCw, Trash2, Package } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailDetailModalProps {
  email: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export function EmailDetailModal({ email, open, onOpenChange, onRefresh }: EmailDetailModalProps) {
  if (!email) return null;

  const handleReprocess = async () => {
    try {
      const { error } = await supabase.functions.invoke('process-email-attachment', {
        body: { inbox_id: email.id, user_id: email.user_id }
      });
      
      if (error) throw error;
      toast.success("Retraitement lancé");
      onRefresh?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors du retraitement");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer cet email ?")) return;
    
    try {
      const { error } = await supabase
        .from('email_inbox')
        .delete()
        .eq('id', email.id);
      
      if (error) throw error;
      toast.success("Email supprimé");
      onRefresh?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: "secondary", icon: AlertCircle, label: "En attente" },
      processing: { variant: "default", icon: RefreshCw, label: "Traitement..." },
      completed: { variant: "default", icon: CheckCircle, label: "Terminé" },
      failed: { variant: "destructive", icon: AlertCircle, label: "Erreur" },
      ignored: { variant: "outline", icon: AlertCircle, label: "Ignoré" },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const logs = Array.isArray(email.processing_logs) ? email.processing_logs : [];
  const mapping = logs.find(log => log.mapping)?.mapping || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Détails de l'email
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="space-y-6 p-1">
            {/* Métadonnées */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">📧 Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Expéditeur</span>
                    <p className="font-medium">{email.from_name || email.from_email}</p>
                    <p className="text-sm text-muted-foreground">{email.from_email}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Statut</span>
                    <div className="mt-1">{getStatusBadge(email.status)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Sujet</span>
                    <p className="font-medium">{email.subject || "Sans sujet"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Date de réception</span>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(email.received_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fichier joint */}
            {email.attachment_name && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">📎 Fichier joint</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-10 w-10 text-primary" />
                      <div>
                        <p className="font-medium">{email.attachment_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{email.attachment_type?.toUpperCase()}</Badge>
                          <span>{email.attachment_size_kb} KB</span>
                        </div>
                      </div>
                    </div>
                    {email.attachment_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={email.attachment_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Télécharger
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mapping détecté */}
            {Object.keys(mapping).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">🔍 Mapping des colonnes (AI)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(mapping).map(([field, column]) => (
                      <div key={field} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <Badge variant="secondary">{column as string}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{field}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Résultats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">📊 Résultats du traitement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">{email.products_found || 0}</div>
                    <p className="text-xs text-muted-foreground">Produits trouvés</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{email.products_created || 0}</div>
                    <p className="text-xs text-muted-foreground">Créés</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{email.products_updated || 0}</div>
                    <p className="text-xs text-muted-foreground">Mis à jour</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logs détaillés */}
            {logs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">📝 Timeline du traitement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {logs.map((log: any, idx: number) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          {idx < logs.length - 1 && <div className="w-px h-full bg-border" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <p className="font-medium">{log.message || log.step}</p>
                          {log.timestamp && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.timestamp), "HH:mm:ss", { locale: fr })}
                            </p>
                          )}
                          {log.details && (
                            <p className="text-xs text-muted-foreground mt-1">{log.details}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Erreur */}
            {email.error_message && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-sm text-destructive">❌ Erreur</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-destructive">{email.error_message}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
            {(email.status === 'failed' || email.status === 'pending') && (
              <Button onClick={handleReprocess}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retraiter
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

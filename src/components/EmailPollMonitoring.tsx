import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, TrendingUp, Eye, AlertCircle, Activity, Mail } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export function EmailPollMonitoring() {
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [liveProgress, setLiveProgress] = useState<{
    step: string;
    progress: number;
    emailsScanned: number;
    totalEmails: number;
    elapsedTime: number;
    errors: string[];
  } | null>(null);
  
  const { data: pollLogs, refetch } = useQuery({
    queryKey: ['email-poll-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_poll_logs')
        .select(`
          *,
          supplier_configurations(supplier_name, connection_config)
        `)
        .order('poll_time', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Group by supplier_id and keep only latest
      const latestBySupplier = new Map();
      data?.forEach(log => {
        if (!latestBySupplier.has(log.supplier_id)) {
          latestBySupplier.set(log.supplier_id, log);
        }
      });

      return Array.from(latestBySupplier.values());
    },
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['email-poll-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_poll_logs')
        .select('*')
        .gte('poll_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const totalEmails = data.reduce((sum, log) => sum + (log.emails_processed || 0), 0);
      const successCount = data.filter(log => log.status === 'emails_found' || log.status === 'no_new_emails').length;
      const successRate = (successCount / Math.max(data.length, 1)) * 100;

      return { 
        totalEmails, 
        successRate: successRate.toFixed(1), 
        totalPolls: data.length 
      };
    },
    refetchInterval: 60000,
  });

  // Realtime progress monitoring via imap_session_logs
  useEffect(() => {
    const channel = supabase
      .channel('imap-progress')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'imap_session_logs',
        },
        (payload) => {
          const session = payload.new;
          const commands = session.commands_sent || [];
          const lastCommand = commands[commands.length - 1] || '';
          
          let step = 'Initialisation';
          let progress = 10;
          
          if (lastCommand.includes('AUTHENTICATE') || lastCommand.includes('LOGIN')) {
            step = 'Authentification en cours';
            progress = 30;
          } else if (lastCommand.includes('SELECT')) {
            step = 'Sélection de la boîte';
            progress = 50;
          } else if (lastCommand.includes('SEARCH')) {
            step = 'Recherche d\'emails';
            progress = 60;
          } else if (lastCommand.includes('FETCH')) {
            step = 'Téléchargement des pièces jointes';
            const fetchCount = commands.filter(c => c.includes('FETCH')).length;
            progress = 70 + Math.min(fetchCount * 2, 20);
          } else if (lastCommand.includes('STORE')) {
            step = 'Marquage des emails comme lus';
            progress = 95;
          } else if (lastCommand.includes('LOGOUT')) {
            step = 'Terminé';
            progress = 100;
          }

          const sessionStart = new Date(session.session_start).getTime();
          const sessionEnd = session.session_end ? new Date(session.session_end).getTime() : Date.now();
          const elapsedMs = sessionEnd - sessionStart;

          setLiveProgress({
            step,
            progress,
            emailsScanned: commands.filter(c => c.includes('FETCH') && c.includes('BODY')).length,
            totalEmails: 0,
            elapsedTime: Math.floor(elapsedMs / 1000),
            errors: session.error_message ? [session.error_message] : [],
          });

          // Clear progress after completion
          if (progress === 100) {
            setTimeout(() => setLiveProgress(null), 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleManualPoll = async () => {
    const loadingToast = toast.loading("Déclenchement de la vérification...");
    
    try {
      const { error } = await supabase.functions.invoke('email-imap-scheduler');
      
      toast.dismiss(loadingToast);
      
      if (error) throw error;
      
      toast.success("Vérification déclenchée! Les résultats apparaîtront dans quelques instants.");
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Manual poll error:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'emails_found':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Emails trouvés</Badge>;
      case 'no_new_emails':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Aucun nouveau</Badge>;
      case 'auth_failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Auth échouée</Badge>;
      case 'connection_error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erreur connexion</Badge>;
      case 'processing_error':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Erreur traitement</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Live Progress Card */}
        {liveProgress && (
          <Card className="border-primary bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 animate-pulse text-primary" />
                Polling IMAP en cours - {liveProgress.step}
              </CardTitle>
              <CardDescription>
                {liveProgress.emailsScanned} email(s) scanné(s) • {liveProgress.elapsedTime}s écoulé
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Progression</span>
                  <span>{liveProgress.progress}%</span>
                </div>
                <Progress value={liveProgress.progress} className="h-2" />
              </div>
              
              {liveProgress.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Erreurs détectées :
                  </p>
                  {liveProgress.errors.map((error, i) => (
                    <div key={i} className="text-sm bg-destructive/10 text-destructive p-3 rounded-md">
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Emails traités (7j)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalEmails || 0}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 inline mr-1" />
                {stats?.totalPolls || 0} vérifications
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Taux de succès</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.successRate || 0}%</div>
              <p className="text-xs text-muted-foreground">Connexions réussies</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Fournisseurs actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pollLogs?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Avec polling IMAP activé</p>
            </CardContent>
          </Card>
        </div>

        {/* Main monitoring table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Monitoring des Vérifications Email</CardTitle>
            <div className="flex gap-2 items-center">
              <p className="text-sm text-muted-foreground">
                Auto: toutes les 15 min
              </p>
              <Button onClick={handleManualPoll} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Vérifier maintenant
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Emails</TableHead>
                  <TableHead>Dernière vérification</TableHead>
                  <TableHead>Alerte</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pollLogs?.map((log: any) => {
                  const lastPoll = new Date(log.poll_time);
                  const hoursSinceLastPoll = (Date.now() - lastPoll.getTime()) / (1000 * 60 * 60);
                  const isInactive = hoursSinceLastPoll > 24;
                  
                  return (
                    <TableRow key={log.id} className={isInactive ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-medium">
                        {log.supplier_configurations?.supplier_name || 'Inconnu'}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div>Trouvés: <Badge variant="secondary">{log.emails_found || 0}</Badge></div>
                          <div className="text-muted-foreground">Traités: <Badge variant="default">{log.emails_processed || 0}</Badge></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {lastPoll.toLocaleString('fr-FR')}
                          <div className="text-xs text-muted-foreground">
                            Il y a {Math.floor(hoursSinceLastPoll)}h
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isInactive && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Inactif &gt;24h
                          </Badge>
                        )}
                        {log.error_message && !isInactive && (
                          <Badge variant="destructive" className="text-xs">
                            Erreur
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const testToast = toast.loading("Test de connexion IMAP...");
                              try {
                                const { error } = await supabase.functions.invoke('test-imap-connection', {
                                  body: {
                                    host: log.supplier_configurations?.connection_config?.imap_host,
                                    port: log.supplier_configurations?.connection_config?.imap_port || 993,
                                    email: log.supplier_configurations?.connection_config?.imap_email,
                                    password: log.supplier_configurations?.connection_config?.imap_password,
                                    ssl: log.supplier_configurations?.connection_config?.imap_ssl !== false,
                                    folder: log.supplier_configurations?.connection_config?.imap_folder || 'INBOX'
                                  }
                                });
                                
                                toast.dismiss(testToast);
                                if (error) throw error;
                                toast.success("✅ Connexion IMAP réussie!");
                              } catch (error: any) {
                                toast.dismiss(testToast);
                                toast.error(`❌ Échec: ${error.message}`);
                              }
                            }}
                          >
                            Tester
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!pollLogs?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucune vérification effectuée pour le moment
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Détails de la vérification</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {selectedLog && (
              <div className="space-y-4 p-4">
                <div>
                  <h4 className="font-semibold mb-2">Informations générales</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Fournisseur:</span>{' '}
                      {selectedLog.supplier_configurations?.supplier_name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Statut:</span>{' '}
                      {getStatusBadge(selectedLog.status)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Emails trouvés:</span>{' '}
                      {selectedLog.emails_found || 0}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Emails traités:</span>{' '}
                      {selectedLog.emails_processed || 0}
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Date:</span>{' '}
                      {new Date(selectedLog.poll_time).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>

                {selectedLog.error_message && (
                  <div>
                    <h4 className="font-semibold mb-2 text-destructive">Erreur</h4>
                    <p className="text-sm bg-destructive/10 p-3 rounded">
                      {selectedLog.error_message}
                    </p>
                  </div>
                )}

                {selectedLog.details && (
                  <div>
                    <h4 className="font-semibold mb-2">Détails techniques</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

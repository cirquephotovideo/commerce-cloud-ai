import { useState } from "react";
import { useImportErrors, useRetryableErrors } from "@/hooks/useImportErrors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Clock, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const ImportErrorsManager = () => {
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const { data: errors, isLoading, refetch } = useImportErrors(filter);
  const { data: retryableErrors } = useRetryableErrors();
  const [retrying, setRetrying] = useState<string[]>([]);

  const handleRetry = async (errorId: string) => {
    setRetrying(prev => [...prev, errorId]);
    
    try {
      // Get current retry count first
      const { data: errorData } = await supabase
        .from('import_errors')
        .select('retry_count')
        .eq('id', errorId)
        .single();

      const currentRetryCount = errorData?.retry_count || 0;

      const { error } = await supabase
        .from('import_errors')
        .update({
          retry_count: currentRetryCount + 1,
          last_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', errorId);

      if (error) throw error;

      toast.success("Retry planifié avec succès");
      refetch();
    } catch (error: any) {
      toast.error("Erreur lors du retry: " + error.message);
    } finally {
      setRetrying(prev => prev.filter(id => id !== errorId));
    }
  };

  const handleBulkRetry = async () => {
    try {
      const { error } = await supabase.functions.invoke("retry-failed-imports");
      if (error) throw error;
      toast({ title: "Retry en masse lancé avec succès" });
      queryClient.invalidateQueries({ queryKey: ["import-errors"] });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleMarkResolved = async (errorId: string, method: 'manual_fix' | 'ignored') => {
    try {
      const { error } = await supabase
        .from('import_errors')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_method: method,
          updated_at: new Date().toISOString(),
        })
        .eq('id', errorId);

      if (error) throw error;

      toast.success("Erreur marquée comme résolue");
      refetch();
    } catch (error: any) {
      toast.error("Erreur: " + error.message);
    }
  };

  const getErrorTypeIcon = (type: string) => {
    switch (type) {
      case 'connection':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'parsing':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'validation':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'database':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-purple-500" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getErrorTypeBadge = (type: string) => {
    const variants: Record<string, any> = {
      connection: 'destructive',
      parsing: 'secondary',
      validation: 'outline',
      database: 'destructive',
      timeout: 'secondary',
    };
    return variants[type] || 'default';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erreurs Non Résolues</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errors?.filter(e => !e.resolved_at).length || 0}</div>
            <p className="text-xs text-muted-foreground">nécessitent une attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Éligibles au Retry</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{retryableErrors?.length || 0}</div>
            <p className="text-xs text-muted-foreground">peuvent être retentées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Résolues</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errors?.filter(e => e.resolved_at).length || 0}</div>
            <p className="text-xs text-muted-foreground">corrigées ou ignorées</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="unresolved">Non Résolues</TabsTrigger>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="resolved">Résolues</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Erreurs d'Import</CardTitle>
              <CardDescription>
                Gérer et corriger les erreurs d'import avec retry automatique
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Retry</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors?.map((error) => (
                    <TableRow key={error.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getErrorTypeIcon(error.error_type)}
                          <Badge variant={getErrorTypeBadge(error.error_type)}>
                            {error.error_type}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {error.error_message}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{error.product_reference || '-'}</code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {error.retry_count}/{error.max_retries}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(error.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {!error.resolved_at && error.retry_count < error.max_retries && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry(error.id)}
                              disabled={retrying.includes(error.id)}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Retry
                            </Button>
                          )}
                          {!error.resolved_at && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMarkResolved(error.id, 'manual_fix')}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Résolu
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMarkResolved(error.id, 'ignored')}
                              >
                                Ignorer
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!errors || errors.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucune erreur trouvée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

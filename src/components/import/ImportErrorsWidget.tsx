import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, XCircle, RefreshCw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useEffect } from "react";

interface ImportError {
  id: string;
  error_type: string;
  error_message: string;
  created_at: string;
  retry_count: number;
  max_retries: number;
  import_jobs?: {
    supplier_configurations?: {
      supplier_name: string;
    };
  };
}

export function ImportErrorsWidget() {
  const { data: errors, refetch } = useQuery({
    queryKey: ['import-errors-recent'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('import_errors')
        .select(`
          *,
          import_jobs(
            supplier_configurations(supplier_name)
          )
        `)
        .eq('user_id', user.id)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as ImportError[];
    },
    refetchInterval: 5000,
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('import-errors-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'import_errors'
      }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const handleRetry = async (errorId: string) => {
    // Get current retry count
    const { data: currentError } = await supabase
      .from('import_errors')
      .select('retry_count')
      .eq('id', errorId)
      .single();

    if (!currentError) {
      toast.error("Erreur introuvable");
      return;
    }

    const { error } = await supabase
      .from('import_errors')
      .update({ 
        retry_count: currentError.retry_count + 1,
        last_retry_at: new Date().toISOString()
      })
      .eq('id', errorId);

    if (error) {
      toast.error("Erreur lors du retry");
      return;
    }

    toast.success("Tentative de réimport lancée");
    refetch();
  };

  const handleResolve = async (errorId: string) => {
    const { error } = await supabase
      .from('import_errors')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', errorId);

    if (error) {
      toast.error("Erreur lors de la résolution");
      return;
    }

    toast.success("Erreur marquée comme résolue");
    refetch();
  };

  const handleClearAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('import_errors')
      .update({ resolved_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('resolved_at', null);

    if (error) {
      toast.error("Erreur lors de l'effacement");
      return;
    }

    toast.success(`${errors?.length || 0} erreur(s) effacée(s)`);
    refetch();
  };

  const getErrorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'network': 'Réseau',
      'parsing': 'Parsing',
      'validation': 'Validation',
      'database': 'Base de données',
      'timeout': 'Timeout',
      'authentication': 'Authentification',
    };
    return labels[type] || type;
  };

  const getErrorTypeColor = (type: string): "destructive" | "default" | "secondary" | "outline" => {
    const colors: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
      'network': 'destructive',
      'timeout': 'destructive',
      'authentication': 'destructive',
      'parsing': 'secondary',
      'validation': 'secondary',
      'database': 'outline',
    };
    return colors[type] || 'outline';
  };

  if (!errors || errors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-green-500" />
            Erreurs d'import
            <Badge variant="secondary" className="ml-2">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-sm text-muted-foreground">
              Aucune erreur d'import récente
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
            Erreurs d'import
            <Badge variant="destructive" className="ml-2">{errors.length}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {errors.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAll}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Effacer tout
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {errors.map((error) => (
              <div
                key={error.id}
                className="p-4 border rounded-lg bg-destructive/5 border-destructive/20 space-y-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <Badge variant={getErrorTypeColor(error.error_type)}>
                        {getErrorTypeLabel(error.error_type)}
                      </Badge>
                      {error.import_jobs?.supplier_configurations?.supplier_name && (
                        <span className="text-sm font-medium">
                          {error.import_jobs.supplier_configurations.supplier_name}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-foreground font-mono bg-background/50 p-2 rounded">
                      {error.error_message}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {formatDistanceToNow(new Date(error.created_at), { 
                          locale: fr, 
                          addSuffix: true 
                        })}
                      </span>
                      <span>
                        Tentatives: {error.retry_count}/{error.max_retries}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {error.retry_count < error.max_retries && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(error.id)}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolve(error.id)}
                    >
                      <XCircle className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

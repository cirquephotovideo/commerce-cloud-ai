import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, FileText } from "lucide-react";

interface ImportLog {
  id: string;
  filename: string;
  total_rows: number;
  success_count: number;
  failed_count: number;
  created_count: number;
  updated_count: number;
  created_at: string;
  completed_at?: string;
  import_duration_ms?: number;
}

interface ImportHistoryListProps {
  history: ImportLog[];
  isLoading: boolean;
}

export function ImportHistoryList({ history, isLoading }: ImportHistoryListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Aucun historique d'import</p>
        <p className="text-sm mt-2">Vos imports apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((log) => {
        const successRate = (log.success_count / log.total_rows) * 100;
        const isSuccess = log.failed_count === 0;
        
        return (
          <Card key={log.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{log.filename}</span>
                  {isSuccess ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Succès
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Avec erreurs
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Total :</span> {log.total_rows}
                  </div>
                  <div>
                    <span className="font-medium text-green-600">Succès :</span> {log.success_count}
                  </div>
                  <div>
                    <span className="font-medium text-blue-600">Créés :</span> {log.created_count}
                  </div>
                  <div>
                    <span className="font-medium text-orange-600">Mis à jour :</span> {log.updated_count}
                  </div>
                </div>

                {log.failed_count > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    <XCircle className="h-3 w-3 inline mr-1" />
                    {log.failed_count} échecs
                  </div>
                )}
              </div>

              <div className="text-right text-xs text-muted-foreground ml-4">
                <div className="flex items-center gap-1 justify-end mb-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                </div>
                {log.import_duration_ms && (
                  <div className="text-[10px]">
                    Durée : {(log.import_duration_ms / 1000).toFixed(1)}s
                  </div>
                )}
                <div className="mt-1">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${successRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, History, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export const AuditTrail = () => {
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const getActionColor = (action: string) => {
    if (action.includes("create") || action.includes("insert")) return "default";
    if (action.includes("update") || action.includes("modify")) return "secondary";
    if (action.includes("delete") || action.includes("remove")) return "destructive";
    return "outline";
  };

  const getActionIcon = (entityType: string) => {
    return <FileText className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historique d'Audit
        </CardTitle>
        <CardDescription>
          Journal complet de toutes les modifications effectuées
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-3">
            {auditLogs?.map((log) => (
              <div key={log.id} className="p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getActionIcon(log.entity_type)}</div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getActionColor(log.action) as any}>
                        {log.action}
                      </Badge>
                      <span className="text-sm font-medium">{log.entity_type}</span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      {new Date(log.created_at).toLocaleString("fr-FR")}
                    </p>

                    {log.old_values && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Anciennes valeurs
                        </summary>
                        <pre className="mt-2 p-2 bg-accent rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.old_values, null, 2)}
                        </pre>
                      </details>
                    )}

                    {log.new_values && (
                      <details className="text-sm mt-2">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Nouvelles valeurs
                        </summary>
                        <pre className="mt-2 p-2 bg-accent rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.new_values, null, 2)}
                        </pre>
                      </details>
                    )}

                    {log.ip_address && (
                      <p className="text-xs text-muted-foreground mt-2">
                        IP: {log.ip_address}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {!auditLogs?.length && (
              <p className="text-center text-muted-foreground py-8">
                Aucune activité enregistrée
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

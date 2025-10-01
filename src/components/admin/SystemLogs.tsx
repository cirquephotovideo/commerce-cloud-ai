import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

interface ExportLog {
  id: string;
  user_id: string;
  products_count: number;
  success_count: number;
  error_count: number;
  created_at: string;
  export_details: any;
}

export const SystemLogs = () => {
  const [logs, setLogs] = useState<ExportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("export_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Logs d'Export Odoo</CardTitle>
          <Button onClick={fetchLogs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Produits</TableHead>
                <TableHead>Succès</TableHead>
                <TableHead>Erreurs</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {new Date(log.created_at).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.user_id.substring(0, 8)}...
                  </TableCell>
                  <TableCell>{log.products_count}</TableCell>
                  <TableCell>
                    <span className="text-green-600 font-medium">
                      {log.success_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-red-600 font-medium">
                      {log.error_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    {log.error_count === 0 ? (
                      <Badge className="bg-green-500">Succès</Badge>
                    ) : log.success_count > 0 ? (
                      <Badge className="bg-yellow-500">Partiel</Badge>
                    ) : (
                      <Badge variant="destructive">Échec</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {logs.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun log d'export disponible
          </div>
        )}
      </CardContent>
    </Card>
  );
};

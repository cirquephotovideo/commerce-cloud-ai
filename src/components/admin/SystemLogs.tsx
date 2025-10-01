import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface PlatformExportLog extends ExportLog {
  platform_type: string;
}

export const SystemLogs = () => {
  const [odooLogs, setOdooLogs] = useState<ExportLog[]>([]);
  const [platformLogs, setPlatformLogs] = useState<PlatformExportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // Fetch Odoo logs
      const { data: odooData, error: odooError } = await supabase
        .from("export_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (odooError) throw odooError;
      setOdooLogs(odooData || []);

      // Fetch platform logs
      const { data: platformData, error: platformError } = await supabase
        .from("platform_export_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (platformError) throw platformError;
      setPlatformLogs(platformData || []);
      
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

  const getPlatformEmoji = (platform: string) => {
    const emojis: Record<string, string> = {
      shopify: '🏪',
      woocommerce: '🌐',
      prestashop: '🛒',
      magento: '📦',
      salesforce: '☁️',
      sap: '🏢',
      uber_eats: '🍔',
      deliveroo: '🚚',
      just_eat: '📱',
      windev: '💻'
    };
    return emojis[platform] || '🔧';
  };

  const LogsTable = ({ logs, showPlatform = false }: { logs: any[], showPlatform?: boolean }) => (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showPlatform && <TableHead>Plateforme</TableHead>}
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
              {showPlatform && (
                <TableCell>
                  <span className="flex items-center gap-1">
                    {getPlatformEmoji(log.platform_type)}
                    {log.platform_type}
                  </span>
                </TableCell>
              )}
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
      {logs.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          Aucun log d'export disponible
        </div>
      )}
    </>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Logs d'Export</CardTitle>
          <Button onClick={fetchLogs} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">Toutes les plateformes</TabsTrigger>
              <TabsTrigger value="odoo">Odoo</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <LogsTable logs={platformLogs} showPlatform />
            </TabsContent>

            <TabsContent value="odoo">
              <LogsTable logs={odooLogs} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

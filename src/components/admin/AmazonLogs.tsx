import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, Download, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface LogEntry {
  timestamp: number;
  event_message: string;
  event_type: string;
  level: string;
  function_id?: string;
}

export function AmazonLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFunction, setSelectedFunction] = useState("amazon-product-enrichment");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const functions = [
    { value: "amazon-product-enrichment", label: "Amazon Product Enrichment" },
    { value: "amazon-token-manager", label: "Amazon Token Manager" },
  ];

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('supabase--edge-function-logs', {
        body: {
          function_name: selectedFunction,
          search: searchTerm || ""
        }
      });

      if (error) throw error;

      if (data && Array.isArray(data)) {
        setLogs(data);
        setFilteredLogs(data);
      }
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      toast.error("Erreur lors du chargement des logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedFunction]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedFunction, searchTerm]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = logs.filter(log => 
        log.event_message.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLogs(filtered);
    } else {
      setFilteredLogs(logs);
    }
  }, [searchTerm, logs]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp / 1000).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLevelBadgeVariant = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'destructive';
      case 'warn':
      case 'warning':
        return 'secondary';
      case 'info':
        return 'default';
      default:
        return 'outline';
    }
  };

  const exportLogs = () => {
    const content = filteredLogs.map(log => 
      `[${formatTimestamp(log.timestamp)}] [${log.level}] [${log.event_type}] ${log.event_message}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon-logs-${selectedFunction}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exportés avec succès");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Logs Amazon Seller</h2>
        <p className="text-muted-foreground mt-2">
          Consultez les logs en temps réel et l'historique des fonctions d'enrichissement Amazon
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Surveillance des Logs</CardTitle>
              <CardDescription>
                Logs des fonctions edge Amazon - {filteredLogs.length} entrées
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
                disabled={filteredLogs.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {functions.map((func) => (
                    <SelectItem key={func.value} value={func.value}>
                      {func.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans les logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>

          <ScrollArea className="h-[600px] rounded-md border">
            <div className="p-4 space-y-2">
              {loading && filteredLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Chargement des logs...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Aucun log disponible
                </div>
              ) : (
                filteredLogs.map((log, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getLevelBadgeVariant(log.level)}>
                            {log.level}
                          </Badge>
                          <Badge variant="outline">{log.event_type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                          {log.event_message}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

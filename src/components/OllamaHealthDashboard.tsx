import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOllamaHealth } from "@/hooks/useOllamaHealth";
import { Activity, Server, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function OllamaHealthDashboard() {
  const { data: healthData, isLoading, refetch } = useOllamaHealth();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ollama-health"] });
    refetch();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return (
          <Badge className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            En ligne
          </Badge>
        );
      case "degraded":
        return (
          <Badge className="bg-amber-600">
            <Activity className="h-3 w-3 mr-1" />
            Dégradé
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Hors ligne
          </Badge>
        );
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            État du serveur Ollama
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Vérification de l'état du serveur...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              État du serveur Ollama
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!healthData || healthData.length === 0 ? (
            <Alert>
              <AlertDescription>
                Aucune donnée de santé disponible. Assurez-vous qu'Ollama est configuré correctement.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {healthData.map((provider) => (
                <Card key={provider.provider} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        <h3 className="font-semibold">
                          {provider.provider === "ollama_cloud"
                            ? "Ollama Cloud"
                            : "Ollama Local"}
                        </h3>
                      </div>
                      {getStatusBadge(provider.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Response Time */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Temps de réponse
                      </span>
                      <span className="font-medium">
                        {provider.response_time_ms
                          ? `${provider.response_time_ms} ms`
                          : "N/A"}
                      </span>
                    </div>

                    {/* Last Check */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Dernière vérification
                      </span>
                      <span className="text-sm">
                        {new Date(provider.last_check).toLocaleString("fr-FR")}
                      </span>
                    </div>

                    {/* Available Models */}
                    {provider.available_models && provider.available_models.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Modèles disponibles:</span>
                        <div className="flex flex-wrap gap-2">
                          {provider.available_models.map((model) => (
                            <Badge key={model} variant="outline" className="text-xs">
                              {model}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status Info */}
                    {provider.status === "offline" && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          Le serveur ne répond pas. Vérifiez que le service est démarré.
                        </AlertDescription>
                      </Alert>
                    )}
                    {provider.status === "degraded" && (
                      <Alert>
                        <AlertDescription>
                          Le serveur répond lentement. Certaines fonctionnalités peuvent être ralenties.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Configuration Info */}
          <div className="mt-6">
            <Alert>
              <AlertDescription>
                <p className="font-semibold mb-2">ℹ️ Configuration d'Ollama</p>
                <p className="text-sm">
                  Consultez la{" "}
                  <a
                    href="/docs/OLLAMA_INTEGRATION.md"
                    className="underline text-primary"
                    target="_blank"
                  >
                    documentation d'intégration Ollama
                  </a>{" "}
                  pour plus d'informations sur la configuration et l'utilisation.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

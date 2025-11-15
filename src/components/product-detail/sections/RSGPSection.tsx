import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, FileText, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useEnrichment } from "@/hooks/useEnrichment";
import { RSGPDetailedView } from "./RSGPDetailedView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RSGPSectionProps {
  analysis: any;
  onEnrich?: () => void;
}

export const RSGPSection = ({ analysis, onEnrich }: RSGPSectionProps) => {
  // Early return si analysis n'existe pas
  if (!analysis?.id) {
    return null;
  }
  
  const enrichMutation = useEnrichment(analysis.id, onEnrich);
  const rsgpData = analysis?.rsgp_compliance || analysis?.rsgp_data || analysis?.analysis_result?.rsgp_compliance;
  const rsgpGeneratedAt = analysis?.rsgp_generated_at || analysis?.analysis_result?._web_search_timestamp;
  
  const hasDetailedData = rsgpData?.donnees_detaillees ? true : false;

  // Query enrichment queue status for auto-refresh
  const { data: enrichmentStatus, refetch } = useQuery({
    queryKey: ['enrichment-status', analysis.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrichment_queue')
        .select('status, error_message, completed_at')
        .eq('analysis_id', analysis.id)
        .contains('enrichment_type', ['rsgp_ollama'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!analysis?.id, // Ne s'exécute que si analysis.id existe
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'processing' || status === 'pending' ? 5000 : false;
    },
    refetchOnWindowFocus: true,
  });

  if (!rsgpData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Conformité RSGP
          </CardTitle>
          <CardDescription>
            Analyse de conformité non disponible
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show processing status */}
          {enrichmentStatus?.status === 'processing' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Analyse en cours...</AlertTitle>
              <AlertDescription>
                L'analyse RSGP approfondie prendra 1-2 minutes avec recherche web automatique. 
                La page se mettra à jour automatiquement.
              </AlertDescription>
            </Alert>
          )}

          {/* Show error if completed without data */}
          {enrichmentStatus?.status === 'completed' && !rsgpData && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erreur lors de l'analyse</AlertTitle>
              <AlertDescription>
                L'enrichissement s'est terminé mais n'a pas produit de résultats. 
                Cliquez sur "Analyser avec IA" pour relancer.
              </AlertDescription>
            </Alert>
          )}

          {/* Show failed status */}
          {enrichmentStatus?.status === 'failed' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Échec de l'analyse</AlertTitle>
              <AlertDescription>
                {enrichmentStatus.error_message || "Une erreur s'est produite. Réessayez."}
              </AlertDescription>
            </Alert>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  className="w-full gap-2"
                  onClick={() => {
                    enrichMutation.mutate({ enrichmentType: ['rsgp_ollama'] });
                    setTimeout(() => refetch(), 1000);
                  }}
                  disabled={enrichMutation.isPending || enrichmentStatus?.status === 'processing'}
                >
                  {enrichMutation.isPending || enrichmentStatus?.status === 'processing' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Recherche en cours...
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" />
                      🔍 Analyser avec IA + Recherche Web
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Analyse approfondie avec Ollama et recherche web automatique</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>
    );
  }

  const isCompliant = rsgpData.status === 'compliant';
  const checks = rsgpData.checks || [];
  const warnings = rsgpData.warnings || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Conformité RSGP (Sécurité Produits)
        </CardTitle>
        <CardDescription>
          Réglementation Générale sur la Sécurité des Produits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasDetailedData ? (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Vue Résumée</TabsTrigger>
              <TabsTrigger value="detailed">Vue Détaillée</TabsTrigger>
              <TabsTrigger value="json">JSON brut</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="space-y-4 mt-4">{/* ... keep existing code */}
        {/* Statut global */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Statut</div>
            {rsgpGeneratedAt && (
              <div className="text-xs text-muted-foreground">
                • Analysé {formatDistanceToNow(new Date(rsgpGeneratedAt), {
                  addSuffix: true,
                  locale: fr
                })}
              </div>
            )}
          </div>
          <Badge variant={isCompliant ? "default" : "destructive"} className="gap-1">
            {isCompliant ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Conforme
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" />
                Non conforme
              </>
            )}
          </Badge>
        </div>

        {/* Points de conformité */}
        {checks.length > 0 && (
          <div className="space-y-2">
            {checks.map((check: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{check.description || check}</span>
              </div>
            ))}
          </div>
        )}

        {/* Avertissements */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <span>{warning.description || warning}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" className="gap-2">
            <FileText className="h-3 w-3" />
            Télécharger rapport
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="gap-2"
            onClick={() => enrichMutation.mutate({ enrichmentType: ['rsgp_ollama'] })}
            disabled={enrichMutation.isPending}
          >
            {enrichMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Globe className="h-3 w-3" />
            )}
            Recherche Web
          </Button>
        </div>
            </TabsContent>
            
            <TabsContent value="detailed" className="mt-4">
              <RSGPDetailedView data={rsgpData} />
            </TabsContent>
            
            <TabsContent value="json" className="mt-4">
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[600px] text-xs">
                {JSON.stringify(rsgpData, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        ) : (
          <>
        {/* Statut global */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Statut</div>
            {rsgpGeneratedAt && (
              <div className="text-xs text-muted-foreground">
                • Analysé {formatDistanceToNow(new Date(rsgpGeneratedAt), {
                  addSuffix: true,
                  locale: fr
                })}
              </div>
            )}
          </div>
          <Badge variant={isCompliant ? "default" : "destructive"} className="gap-1">
            {isCompliant ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Conforme
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" />
                Non conforme
              </>
            )}
          </Badge>
        </div>

        {/* Points de conformité */}
        {checks.length > 0 && (
          <div className="space-y-2">
            {checks.map((check: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{check.description || check}</span>
              </div>
            ))}
          </div>
        )}

        {/* Avertissements */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <span>{warning.description || warning}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" className="gap-2">
            <FileText className="h-3 w-3" />
            Télécharger rapport
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="gap-2"
            onClick={() => enrichMutation.mutate({ enrichmentType: ['rsgp_ollama'] })}
            disabled={enrichMutation.isPending}
          >
            {enrichMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Globe className="h-3 w-3" />
            )}
            Recherche Web
          </Button>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

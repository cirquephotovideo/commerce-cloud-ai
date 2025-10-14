import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Package, Battery, Wifi, Ruler, Weight } from "lucide-react";
import { EnrichmentStatusIndicator } from "../EnrichmentStatusIndicator";
import { useEnrichment } from "@/hooks/useEnrichment";

interface SpecsSectionProps {
  analysis: any;
}

export const SpecsSection = ({ analysis }: SpecsSectionProps) => {
  const enrichMutation = useEnrichment(analysis.id);
  
  // Données existantes
  const specifications = analysis?.analysis_result?.specifications;
  const costAnalysis = analysis?.analysis_result?.cost_analysis;
  const technicalDescription = analysis?.analysis_result?.technical_description;
  
  // Statuts d'enrichissement
  const enrichmentStatus = analysis?.enrichment_status || {};

  // Extraire dimensions, batterie, connectivité depuis analysis_result
  const dimensions = analysis?.analysis_result?.dimensions || 
                     analysis?.analysis_result?.technical_specifications?.dimensions;
  const battery = analysis?.analysis_result?.battery || 
                  analysis?.analysis_result?.technical_specifications?.battery;
  const connectivity = analysis?.analysis_result?.connectivity || 
                       analysis?.analysis_result?.technical_specifications?.connectivity;

  return (
    <div className="space-y-4">
      {/* Spécifications Techniques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Spécifications Techniques
            </span>
            <EnrichmentStatusIndicator status={enrichmentStatus.specifications} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {specifications ? (
            <div className="prose prose-sm max-w-none">
              {typeof specifications === 'string' ? (
                <p className="whitespace-pre-wrap">{specifications}</p>
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(specifications, null, 2)}</pre>
              )}
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Aucune spécification technique disponible
              </p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => enrichMutation.mutate({ enrichmentType: ['specifications'] })}
                disabled={enrichMutation.isPending}
              >
                📋 Enrichir Spécifications
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analyse des Coûts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Analyse des Coûts
            </span>
            <EnrichmentStatusIndicator status={enrichmentStatus.cost_analysis} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {costAnalysis ? (
            <div className="prose prose-sm max-w-none">
              {typeof costAnalysis === 'string' ? (
                <p className="whitespace-pre-wrap">{costAnalysis}</p>
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(costAnalysis, null, 2)}</pre>
              )}
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Aucune analyse de coûts disponible
              </p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => enrichMutation.mutate({ enrichmentType: ['cost_analysis'] })}
                disabled={enrichMutation.isPending}
              >
                💰 Enrichir Analyse de Coûts
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description Technique */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Description Technique
            </span>
            <EnrichmentStatusIndicator status={enrichmentStatus.technical_description} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {technicalDescription ? (
            <div className="prose prose-sm max-w-none">
              {typeof technicalDescription === 'string' ? (
                <p className="whitespace-pre-wrap">{technicalDescription}</p>
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(technicalDescription, null, 2)}</pre>
              )}
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Aucune description technique disponible
              </p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => enrichMutation.mutate({ enrichmentType: ['technical_description'] })}
                disabled={enrichMutation.isPending}
              >
                🔧 Enrichir Description Technique
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dimensions */}
      {dimensions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Dimensions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(dimensions).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs text-muted-foreground capitalize">{key}</p>
                  <p className="font-medium">{value as string}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batterie */}
      {battery && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Battery className="h-5 w-5" />
              Batterie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(battery).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-sm capitalize">{key}:</span>
                  <span className="text-sm font-medium">{value as string}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connectivité */}
      {connectivity && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Connectivité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(connectivity) ? (
                connectivity.map((tech: string, index: number) => (
                  <Badge key={index} variant="secondary">{tech}</Badge>
                ))
              ) : (
                <p className="text-sm">{connectivity}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Edit, Sparkles, CheckCircle2, XCircle, Loader2, Zap, ExternalLink } from "lucide-react";
import { useEnrichment } from "@/hooks/useEnrichment";
import { EnrichmentProgress } from "../EnrichmentProgress";
import { PreExportValidationCard } from "@/components/export/PreExportValidationCard";
import { useState } from "react";

interface DescriptionSectionProps {
  analysis: any;
  onEnrich?: () => void;
}

export const DescriptionSection = ({ analysis, onEnrich }: DescriptionSectionProps) => {
  // Vérification de sécurité
  if (!analysis?.id) {
    return null;
  }
  
  const enrichMutation = useEnrichment(analysis.id, onEnrich);
  const [selectedEnrichments, setSelectedEnrichments] = useState<string[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  const handleEnrichmentToggle = (enrichmentType: string) => {
    setSelectedEnrichments(prev =>
      prev.includes(enrichmentType)
        ? prev.filter(t => t !== enrichmentType)
        : [...prev, enrichmentType]
    );
  };

  const handleLaunchEnrichment = () => {
    if (selectedEnrichments.length === 0) return;
    setShowProgress(true);
    enrichMutation.mutate({ enrichmentType: selectedEnrichments });
  };
  
  // Phase 5: Simplifier l'extraction de la description
  const descriptionData = analysis?.long_description || 
                          analysis?.analysis_result?.description_long || 
                          analysis?.analysis_result?.description;

  const description = typeof descriptionData === 'string' 
    ? descriptionData 
    : (descriptionData?.suggested_description || 
       descriptionData?.current_quality || 
       descriptionData?.key_features || 
       analysis?.analysis_result?.product_description ||
       'Aucune description disponible pour ce produit, car aucune information précise n\'a pu être trouvée lors de la recherche web.');
  
  const webSources = analysis?.analysis_result?._web_sources || [];
  const confidenceLevel = (() => {
    const level = analysis?.analysis_result?._confidence_level || analysis?.confidence_level;
    // S'assurer que c'est une string valide
    if (typeof level === 'string' && ['high', 'medium', 'low'].includes(level)) {
      return level;
    }
    // Si c'est un objet, essayer d'extraire la valeur overall
    if (typeof level === 'object' && level !== null) {
      return level.overall || 'medium';
    }
    return undefined;
  })();
  
  const strengths = analysis?.analysis_result?.strengths || 
                    analysis?.analysis_result?.pros || [];
  
  const weaknesses = analysis?.analysis_result?.weaknesses || 
                     analysis?.analysis_result?.cons || [];

  const specifications = analysis?.analysis_result?.specifications;
  const costAnalysis = analysis?.analysis_result?.cost_analysis;
  const technicalDescription = analysis?.analysis_result?.technical_description;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Description Complète
            {confidenceLevel && (
              <Badge variant={confidenceLevel === 'high' ? 'default' : 'secondary'} className="ml-auto">
                Confiance : {confidenceLevel}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        {/* Description */}
        <div className="text-sm leading-relaxed">
          {description}
        </div>

        {/* Points forts */}
        {strengths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Points Forts
            </div>
            <div className="space-y-1 pl-6">
              {strengths.map((strength: string, index: number) => (
                <div key={index} className="text-sm flex items-start gap-2">
                  <span className="text-green-600">•</span>
                  <span>{strength}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Points faibles */}
        {weaknesses.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <XCircle className="h-4 w-4 text-red-600" />
              Points Faibles
            </div>
            <div className="space-y-1 pl-6">
              {weaknesses.map((weakness: string, index: number) => (
                <div key={index} className="text-sm flex items-start gap-2">
                  <span className="text-red-600">•</span>
                  <span>{weakness}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" className="gap-2">
            <Edit className="h-3 w-3" />
            Modifier
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="gap-2"
            onClick={() => enrichMutation.mutate({ enrichmentType: ['ai_analysis'] })}
            disabled={enrichMutation.isPending}
          >
            {enrichMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Régénération...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Régénérer avec IA
              </>
            )}
          </Button>
        </div>

        {/* Sources Web */}
        {webSources.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Sources web utilisées :</p>
            <div className="space-y-1">
              {webSources.slice(0, 3).map((url: string, idx: number) => (
                <a 
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {new URL(url).hostname}
                </a>
              ))}
            </div>
            <Badge variant="outline" className="mt-3">
              ✅ Enrichi avec Ollama Web Search
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>

      {/* Enrichissements Avancés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Enrichissements Avancés
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="specifications"
                checked={selectedEnrichments.includes('specifications')}
                onCheckedChange={() => handleEnrichmentToggle('specifications')}
              />
              <label htmlFor="specifications" className="text-sm font-medium cursor-pointer">
                📋 Spécifications Techniques Détaillées
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cost_analysis"
                checked={selectedEnrichments.includes('cost_analysis')}
                onCheckedChange={() => handleEnrichmentToggle('cost_analysis')}
              />
              <label htmlFor="cost_analysis" className="text-sm font-medium cursor-pointer">
                💰 Analyse des Coûts et Marges
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="technical_description"
                checked={selectedEnrichments.includes('technical_description')}
                onCheckedChange={() => handleEnrichmentToggle('technical_description')}
              />
              <label htmlFor="technical_description" className="text-sm font-medium cursor-pointer">
                🔧 Description Technique Longue
              </label>
            </div>
          </div>

          <Button 
            onClick={handleLaunchEnrichment}
            disabled={selectedEnrichments.length === 0 || enrichMutation.isPending}
            className="w-full gap-2"
          >
            {enrichMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enrichissement en cours...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Lancer l'Enrichissement ({selectedEnrichments.length})
              </>
            )}
          </Button>

          {showProgress && <EnrichmentProgress analysisId={analysis.id} />}
        </CardContent>
      </Card>

      {/* Spécifications Techniques */}
      {specifications && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📋 Spécifications Techniques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {typeof specifications === 'string' ? (
                <p>{specifications}</p>
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(specifications, null, 2)}</pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyse des Coûts */}
      {costAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💰 Analyse des Coûts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {typeof costAnalysis === 'string' ? (
                <p>{costAnalysis}</p>
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(costAnalysis, null, 2)}</pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Description Technique */}
      {technicalDescription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔧 Description Technique
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {typeof technicalDescription === 'string' ? (
                <p>{technicalDescription}</p>
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(technicalDescription, null, 2)}</pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, Loader2 } from 'lucide-react';
import { useDeepResearch } from '@/hooks/useDeepResearch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DeepResearchButtonProps {
  analysisId: string;
  productData: {
    name: string;
    brand?: string;
    supplier_reference?: string;
    ean?: string;
  };
  purchasePrice?: number;
}

export const DeepResearchButton = ({
  analysisId,
  productData,
  purchasePrice,
}: DeepResearchButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { startDeepResearch, isResearching, result, state } = useDeepResearch();

  const handleStartResearch = async () => {
    setIsOpen(true);
    await startDeepResearch({
      analysisId,
      productData,
      purchasePrice,
      maxCycles: 3,
    });
  };

  const progress = state.maxCycles > 0 
    ? (state.currentCycle / state.maxCycles) * 100 
    : 0;

  return (
    <>
      <Button
        onClick={handleStartResearch}
        disabled={isResearching}
        variant="outline"
        className="gap-2"
      >
        {isResearching ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Recherche en cours...
          </>
        ) : (
          <>
            <Brain className="h-4 w-4" />
            Recherche Approfondie
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Recherche Approfondie en Cours
            </DialogTitle>
            <DialogDescription>
              Analyse itérative avec recherche web pour enrichir les données produit
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isResearching && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Cycle {state.currentCycle} / {state.maxCycles}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            {result && (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  {/* Confidence Level */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Niveau de confiance:</span>
                    <Badge
                      variant={
                        result.confidenceLevel === 'high'
                          ? 'default'
                          : result.confidenceLevel === 'medium'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {result.confidenceLevel === 'high' ? '🎯 Élevé' : 
                       result.confidenceLevel === 'medium' ? '✅ Moyen' : '⚠️ Faible'}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{result.totalCycles}</div>
                      <div className="text-xs text-muted-foreground">Cycles</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{result.allSources.length}</div>
                      <div className="text-xs text-muted-foreground">Sources</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {result.finalSynthesis.long_description.split(' ').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Mots</div>
                    </div>
                  </div>

                  {/* Research Cycles */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Cycles de Recherche</h4>
                    {result.cycles.map((cycle, idx) => (
                      <div key={idx} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Cycle {idx + 1}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {cycle.sources.length} sources
                          </span>
                        </div>
                        <div className="text-sm">
                          <strong>Requête:</strong> {cycle.query}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {cycle.findings.substring(0, 200)}...
                        </div>
                        {cycle.knowledgeGaps.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Lacunes identifiées: {cycle.knowledgeGaps.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Final Description */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">Description Enrichie</h4>
                    <div className="text-sm bg-muted p-4 rounded-lg whitespace-pre-wrap">
                      {result.finalSynthesis.long_description}
                    </div>
                  </div>

                  {/* Specifications */}
                  {result.finalSynthesis.specifications && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Spécifications</h4>
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(result.finalSynthesis.specifications, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Cost Analysis */}
                  {result.finalSynthesis.cost_analysis && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Analyse de Coûts</h4>
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(result.finalSynthesis.cost_analysis, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Sources */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">
                      Sources ({result.allSources.length})
                    </h4>
                    <div className="text-xs space-y-1">
                      {result.allSources.slice(0, 10).map((source, idx) => (
                        <div key={idx} className="truncate">
                          <a
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {source}
                          </a>
                        </div>
                      ))}
                      {result.allSources.length > 10 && (
                        <div className="text-muted-foreground">
                          ... et {result.allSources.length - 10} autres sources
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

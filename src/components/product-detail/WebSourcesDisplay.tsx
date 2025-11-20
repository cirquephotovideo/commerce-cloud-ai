import { ExternalLink, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WebSourcesDisplayProps {
  sources?: string[];
  confidenceLevel?: 'high' | 'medium' | 'low';
  enrichmentDate?: string;
}

export const WebSourcesDisplay = ({ 
  sources = [], 
  confidenceLevel = 'medium',
  enrichmentDate 
}: WebSourcesDisplayProps) => {
  // S'assurer que confidenceLevel est une valeur valide
  const safeConfidenceLevel = (() => {
    if (typeof confidenceLevel === 'string' && ['high', 'medium', 'low'].includes(confidenceLevel)) {
      return confidenceLevel as 'high' | 'medium' | 'low';
    }
    // Si c'est un objet, essayer d'extraire la valeur overall
    if (typeof confidenceLevel === 'object' && confidenceLevel !== null) {
      const level = (confidenceLevel as any).overall;
      if (typeof level === 'string' && ['high', 'medium', 'low'].includes(level)) {
        return level as 'high' | 'medium' | 'low';
      }
    }
    return 'medium' as const;
  })();

  const confidenceConfig = {
    high: { label: 'Haute', color: 'bg-green-500' },
    medium: { label: 'Moyenne', color: 'bg-yellow-500' },
    low: { label: 'Faible', color: 'bg-red-500' }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Sources Web & Confiance
          <Badge className={confidenceConfig[safeConfidenceLevel].color}>
            Confiance {confidenceConfig[safeConfidenceLevel].label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune source web trouvée. Lancez l'enrichissement web pour obtenir des données.
            </p>
          ) : (
            <ul className="space-y-2">
              {sources.map((source, i) => (
                <li key={i} className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-blue-500" />
                  <a 
                    href={source} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate"
                  >
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        {enrichmentDate && (
          <p className="text-xs text-muted-foreground mt-4">
            Dernière mise à jour : {new Date(enrichmentDate).toLocaleString('fr-FR')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

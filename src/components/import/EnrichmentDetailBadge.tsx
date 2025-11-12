import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EnrichmentDetails {
  total: number;
  items: {
    specs: boolean;
    description: boolean;
    cost: boolean;
    rsgp: boolean;
    amazon: boolean;
    video: boolean;
  };
}

interface EnrichmentDetailBadgeProps {
  enrichmentDetails?: EnrichmentDetails;
}

export const EnrichmentDetailBadge = ({ enrichmentDetails }: EnrichmentDetailBadgeProps) => {
  if (!enrichmentDetails || enrichmentDetails.total === 0) {
    return <Badge variant="secondary">📦 Importé</Badge>;
  }

  const { total, items } = enrichmentDetails;
  const maxEnrichments = 6;

  const enrichmentLabels = [
    { key: 'specs', label: 'Spécifications', icon: '📋' },
    { key: 'description', label: 'Description', icon: '📝' },
    { key: 'cost', label: 'Analyse coûts', icon: '💰' },
    { key: 'rsgp', label: 'RSGP', icon: '⚖️' },
    { key: 'amazon', label: 'Amazon', icon: '📦' },
    { key: 'video', label: 'Vidéo', icon: '🎥' },
  ];

  const activeEnrichments = enrichmentLabels
    .filter(({ key }) => items[key as keyof typeof items])
    .map(({ label }) => label);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="default" 
            className={total === maxEnrichments ? "bg-green-600 hover:bg-green-700" : "bg-green-500 hover:bg-green-600"}
          >
            ✅ Enrichi ({total}/{maxEnrichments})
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-sm mb-2">Détails des enrichissements:</p>
            {enrichmentLabels.map(({ key, label, icon }) => {
              const isActive = items[key as keyof typeof items];
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span>{isActive ? '✅' : '❌'}</span>
                  <span className={isActive ? 'text-foreground' : 'text-muted-foreground'}>
                    {icon} {label}
                  </span>
                </div>
              );
            })}
            {activeEnrichments.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                Actifs: {activeEnrichments.join(', ')}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

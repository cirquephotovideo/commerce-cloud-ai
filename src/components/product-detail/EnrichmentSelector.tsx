import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface EnrichmentModule {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'available' | 'pending' | 'unavailable';
  enabled: boolean;
}

interface EnrichmentSelectorProps {
  modules: EnrichmentModule[];
  onToggle: (id: string) => void;
}

export const EnrichmentSelector = ({ modules, onToggle }: EnrichmentSelectorProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          📊 Sélectionnez les informations à afficher
        </h3>
        <Badge variant="outline" className="text-xs">
          {modules.filter(m => m.enabled).length} / {modules.length} activés
        </Badge>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {modules.map((module) => (
          <Button
            key={module.id}
            variant={module.enabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggle(module.id)}
            disabled={module.status === 'unavailable'}
            className="gap-2 transition-all"
          >
            {module.status === 'available' && module.enabled && <span className="text-xs">✅</span>}
            {module.status === 'available' && !module.enabled && <span className="text-xs">☐</span>}
            {module.status === 'pending' && <span className="text-xs">⏳</span>}
            {module.status === 'unavailable' && <span className="text-xs">❌</span>}
            {module.icon}
            {module.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

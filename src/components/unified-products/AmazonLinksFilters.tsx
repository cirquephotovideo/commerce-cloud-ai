import { Badge } from "@/components/ui/badge";

interface AmazonLinksFiltersProps {
  period: 'today' | 'week' | 'month' | 'all';
  setPeriod: (period: 'today' | 'week' | 'month' | 'all') => void;
}

export function AmazonLinksFilters({ period, setPeriod }: AmazonLinksFiltersProps) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <span className="text-sm font-medium text-foreground">Période :</span>
      <Badge 
        variant={period === 'today' ? 'default' : 'outline'}
        onClick={() => setPeriod('today')}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        📅 Aujourd'hui
      </Badge>
      <Badge 
        variant={period === 'week' ? 'default' : 'outline'}
        onClick={() => setPeriod('week')}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        📆 Cette Semaine
      </Badge>
      <Badge 
        variant={period === 'month' ? 'default' : 'outline'}
        onClick={() => setPeriod('month')}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        📊 Ce Mois
      </Badge>
      <Badge 
        variant={period === 'all' ? 'default' : 'outline'}
        onClick={() => setPeriod('all')}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        🌐 Tout
      </Badge>
    </div>
  );
}

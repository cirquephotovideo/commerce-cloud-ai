import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface OdooAttributesDisplayProps {
  attributes: Record<string, string>;
}

export const OdooAttributesDisplay = ({ attributes }: OdooAttributesDisplayProps) => {
  if (!attributes || Object.keys(attributes).length === 0) {
    return null;
  }

  const determinedCount = Object.values(attributes).filter(v => v !== "Non déterminé").length;
  const totalCount = Object.keys(attributes).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            📋 Attributs Odoo
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>{determinedCount}/{totalCount} déterminés</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(attributes).map(([key, value]) => (
            <div key={key} className="flex flex-col space-y-1 p-3 rounded-lg border bg-card">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {key}
              </span>
              <Badge 
                variant={value === "Non déterminé" ? "secondary" : "outline"}
                className="w-fit"
              >
                {value === "Non déterminé" && (
                  <AlertCircle className="h-3 w-3 mr-1" />
                )}
                {value}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

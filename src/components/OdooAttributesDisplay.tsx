import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Tag } from 'lucide-react';

interface OdooAttributesDisplayProps {
  attributes: Record<string, string>;
  category?: string;
}

export const OdooAttributesDisplay = ({ attributes, category }: OdooAttributesDisplayProps) => {
  if (!attributes || Object.keys(attributes).length === 0) {
    return null;
  }

  const determinedCount = Object.values(attributes).filter(v => v !== "Non déterminé").length;
  const totalCount = Object.keys(attributes).length;

  // Mapping des catégories pour l'affichage
  const categoryLabels: Record<string, string> = {
    'hottes': 'Hottes de cuisine',
    'logiciels': 'Logiciels & Licences',
    'electromenager': 'Électroménager',
    'informatique': 'Matériel Informatique',
    'non_categorise': 'Non catégorisé'
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            📋 Attributs Odoo
          </CardTitle>
          <div className="flex items-center gap-3">
            {category && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {categoryLabels[category] || category}
              </Badge>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{determinedCount}/{totalCount} déterminés</span>
            </div>
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

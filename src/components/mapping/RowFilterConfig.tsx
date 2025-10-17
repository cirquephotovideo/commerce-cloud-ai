import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertCircle } from "lucide-react";

interface RowFilterConfigProps {
  skipRowsTop: number;
  skipRowsBottom: number;
  skipPatterns: string[];
  totalRows: number;
  ignoredRowsCount: number;
  onSkipRowsTopChange: (value: number) => void;
  onSkipRowsBottomChange: (value: number) => void;
  onSkipPatternsChange: (patterns: string[]) => void;
}

export function RowFilterConfig({
  skipRowsTop,
  skipRowsBottom,
  skipPatterns,
  totalRows,
  ignoredRowsCount,
  onSkipRowsTopChange,
  onSkipRowsBottomChange,
  onSkipPatternsChange
}: RowFilterConfigProps) {
  const addPattern = () => {
    onSkipPatternsChange([...skipPatterns, '']);
  };

  const updatePattern = (idx: number, value: string) => {
    const newPatterns = [...skipPatterns];
    newPatterns[idx] = value;
    onSkipPatternsChange(newPatterns);
  };

  const removePattern = (idx: number) => {
    onSkipPatternsChange(skipPatterns.filter((_, i) => i !== idx));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🗑️ Étape 2 : Lignes à ignorer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="skip-top">Ignorer les N premières lignes (après en-têtes)</Label>
            <Input 
              id="skip-top"
              type="number" 
              min="0"
              value={skipRowsTop} 
              onChange={(e) => onSkipRowsTopChange(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ex: Feeder a 2 lignes de titre avant les données
            </p>
          </div>
          
          <div>
            <Label htmlFor="skip-bottom">Ignorer les N dernières lignes</Label>
            <Input 
              id="skip-bottom"
              type="number" 
              min="0"
              value={skipRowsBottom} 
              onChange={(e) => onSkipRowsBottomChange(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ex: FVS a 1 ligne de footer publicitaire
            </p>
          </div>
        </div>
        
        <div>
          <Label>Exclure les lignes contenant (patterns)</Label>
          <div className="space-y-2 mt-2">
            {skipPatterns.map((pattern, idx) => (
              <div key={idx} className="flex gap-2">
                <Input 
                  value={pattern}
                  onChange={(e) => updatePattern(idx, e.target.value)}
                  placeholder="*Total* ou Page [0-9]+"
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => removePattern(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={addPattern}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un pattern
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Utilisez * comme joker. Ex: "*Total*" exclura "Total HT", "Grand Total", etc.
          </p>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{ignoredRowsCount}</strong> lignes seront ignorées sur <strong>{totalRows}</strong> total
            {totalRows > 0 && (
              <span className="text-muted-foreground ml-2">
                ({Math.round((ignoredRowsCount / totalRows) * 100)}% ignorées)
              </span>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

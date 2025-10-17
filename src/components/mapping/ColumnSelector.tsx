import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle, Eye, EyeOff } from "lucide-react";

interface ColumnSelectorProps {
  detectedColumns: string[];
  excludedColumns: string[];
  onExcludedColumnsChange: (columns: string[]) => void;
}

export function ColumnSelector({
  detectedColumns,
  excludedColumns,
  onExcludedColumnsChange
}: ColumnSelectorProps) {
  const toggleColumn = (column: string) => {
    if (excludedColumns.includes(column)) {
      onExcludedColumnsChange(excludedColumns.filter(c => c !== column));
    } else {
      onExcludedColumnsChange([...excludedColumns, column]);
    }
  };

  const selectAll = () => {
    onExcludedColumnsChange([]);
  };

  const deselectAll = () => {
    onExcludedColumnsChange([...detectedColumns]);
  };

  const includedCount = detectedColumns.length - excludedColumns.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          👁️ Étape 3 : Sélectionner les colonnes à importer
        </CardTitle>
        <CardDescription>
          Décochez les colonnes inutiles (ex: "Date MAJ", "Code interne", "URL interne")
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={selectAll}
          >
            <Eye className="h-4 w-4 mr-2" />
            Tout sélectionner
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={deselectAll}
          >
            <EyeOff className="h-4 w-4 mr-2" />
            Tout désélectionner
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-2 border rounded-lg">
          {detectedColumns.map((col, idx) => {
            const isIncluded = !excludedColumns.includes(col);
            return (
              <div 
                key={idx} 
                className={`flex items-center space-x-2 p-2 rounded transition-colors ${
                  isIncluded ? 'bg-primary/5' : 'bg-muted/30'
                }`}
              >
                <Checkbox 
                  id={`col-${idx}`}
                  checked={isIncluded}
                  onCheckedChange={() => toggleColumn(col)}
                />
                <Label 
                  htmlFor={`col-${idx}`} 
                  className="cursor-pointer text-sm flex-1"
                >
                  {col}
                </Label>
              </div>
            );
          })}
        </div>
        
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{includedCount}</strong> colonnes seront importées
            {excludedColumns.length > 0 && (
              <span className="text-muted-foreground ml-2">
                ({excludedColumns.length} colonnes cachées)
              </span>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

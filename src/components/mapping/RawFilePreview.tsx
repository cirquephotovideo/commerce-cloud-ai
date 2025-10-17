import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sparkles, Edit } from "lucide-react";

interface RawFilePreviewProps {
  rawRows: any[][];
  detectedHeaderRow: number;
  onHeaderRowChange: (row: number) => void;
}

export function RawFilePreview({ rawRows, detectedHeaderRow, onHeaderRowChange }: RawFilePreviewProps) {
  const displayRows = rawRows.slice(0, 15);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📄 Étape 1 : Aperçu du fichier brut
        </CardTitle>
        <CardDescription>
          Vérifiez la structure réelle du fichier (en-têtes, lignes vides, formats)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 bg-muted">Ligne</TableHead>
                {rawRows[0]?.map((_, colIdx) => (
                  <TableHead key={colIdx} className="bg-muted">
                    Col {colIdx + 1}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row, rowIdx) => (
                <TableRow 
                  key={rowIdx}
                  className={`cursor-pointer hover:bg-muted/50 ${
                    rowIdx === detectedHeaderRow ? 'bg-primary/10 font-semibold' : ''
                  }`}
                  onClick={() => onHeaderRowChange(rowIdx)}
                >
                  <TableCell className="font-mono text-xs font-medium">
                    {rowIdx + 1}
                  </TableCell>
                  {row.map((cell, cellIdx) => (
                    <TableCell 
                      key={cellIdx} 
                      className="text-xs max-w-[200px] truncate"
                      title={String(cell || '')}
                    >
                      {String(cell || '-')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              ✅ En-têtes détectés à la ligne <strong>{detectedHeaderRow + 1}</strong>
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                const newRow = prompt(`Entrez le numéro de ligne des en-têtes (1-${rawRows.length}):`, String(detectedHeaderRow + 1));
                if (newRow) {
                  const rowNum = parseInt(newRow) - 1;
                  if (rowNum >= 0 && rowNum < rawRows.length) {
                    onHeaderRowChange(rowNum);
                  }
                }
              }}
            >
              <Edit className="h-3 w-3 mr-1" />
              Modifier
            </Button>
          </AlertDescription>
        </Alert>

        {rawRows.length > 15 && (
          <p className="text-xs text-muted-foreground text-center">
            Affichage des 15 premières lignes sur {rawRows.length} total
          </p>
        )}
      </CardContent>
    </Card>
  );
}

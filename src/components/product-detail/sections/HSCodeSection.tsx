import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { getHSCodeData } from "@/lib/analysisDataExtractors";

interface HSCodeSectionProps {
  analysis: any;
}

export function HSCodeSection({ analysis }: HSCodeSectionProps) {
  const hsCodeData = getHSCodeData(analysis);

  if (!hsCodeData) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground">Aucun code douanier disponible</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Code Harmonisé (HS Code)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hsCodeData.code && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Code HS</div>
              <Badge variant="outline" className="text-lg font-mono px-4 py-2">
                {hsCodeData.code}
              </Badge>
            </div>
          )}

          {hsCodeData.description && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Description</div>
              <p className="text-sm text-muted-foreground">{hsCodeData.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wrench, CheckCircle, XCircle } from "lucide-react";
import { getRepairabilityData } from "@/lib/analysisDataExtractors";

interface RepairaabilitySectionProps {
  analysis: any;
}

export function RepairabilitySection({ analysis }: RepairaabilitySectionProps) {
  const repairabilityData = getRepairabilityData(analysis);

  if (!repairabilityData) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground">Aucune donnée de réparabilité disponible</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Score de Réparabilité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {repairabilityData.score !== null && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Score global</span>
                <span className="text-2xl font-bold">{repairabilityData.score}/10</span>
              </div>
              <Progress value={repairabilityData.score * 10} className="h-2" />
            </div>
          )}

          {repairabilityData.ease && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Facilité de démontage</div>
              <Badge variant="outline">{repairabilityData.ease}</Badge>
            </div>
          )}

          {repairabilityData.spareParts && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {repairabilityData.spareParts.toLowerCase().includes('disponible') || 
                 repairabilityData.spareParts.toLowerCase().includes('available') ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Disponibilité des pièces détachées</span>
              </div>
              <p className="text-sm text-muted-foreground capitalize">
                {repairabilityData.spareParts}
              </p>
            </div>
          )}

          {repairabilityData.durability && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Durabilité estimée</div>
              <p className="text-lg font-semibold">{repairabilityData.durability}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

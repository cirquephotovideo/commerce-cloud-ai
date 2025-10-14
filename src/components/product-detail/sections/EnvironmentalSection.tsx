import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Leaf, Recycle } from "lucide-react";
import { getEnvironmentalData } from "@/lib/analysisDataExtractors";

interface EnvironmentalSectionProps {
  analysis: any;
}

export function EnvironmentalSection({ analysis }: EnvironmentalSectionProps) {
  const environmentalData = getEnvironmentalData(analysis);

  if (!environmentalData) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground">Aucune donnée environnementale disponible</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-600" />
            Impact Environnemental
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {environmentalData.ecoScore !== null && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Éco-Score</span>
                <span className="text-2xl font-bold">{environmentalData.ecoScore}/100</span>
              </div>
              <Progress value={environmentalData.ecoScore} className="h-2" />
            </div>
          )}

          {environmentalData.co2Emissions && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Empreinte Carbone</div>
              <p className="text-lg font-semibold">{environmentalData.co2Emissions}</p>
            </div>
          )}

          {environmentalData.recyclability && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Recycle className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Recyclabilité</span>
              </div>
              <p className="text-sm text-muted-foreground">{environmentalData.recyclability}</p>
            </div>
          )}

          {environmentalData.certifications && environmentalData.certifications.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Certifications Environnementales</div>
              <div className="flex flex-wrap gap-2">
                {environmentalData.certifications.map((cert, index) => (
                  <Badge key={index} variant="secondary">{cert}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

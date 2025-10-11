import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Ruler, Battery, Wifi, CheckCircle2, XCircle } from "lucide-react";
import { getRepairabilityData, getEnvironmentalData, getHSCodeData } from "@/lib/analysisDataExtractors";

interface SpecsSectionProps {
  analysis: any;
}

export const SpecsSection = ({ analysis }: SpecsSectionProps) => {
  const specs = analysis?.analysis_result?.specifications || {};
  const dimensions = analysis?.analysis_result?.dimensions || {};
  const battery = analysis?.analysis_result?.battery || {};
  const connectivity = analysis?.analysis_result?.connectivity || {};
  
  const repairability = getRepairabilityData(analysis);
  const environmental = getEnvironmentalData(analysis);
  const hsCode = getHSCodeData(analysis);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Spécifications Techniques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dimensions & Poids */}
        {Object.keys(dimensions).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Ruler className="h-4 w-4" />
              Dimensions & Poids
            </div>
            <div className="grid grid-cols-2 gap-2 pl-6 text-sm">
              {Object.entries(dimensions).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key}:</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batterie */}
        {Object.keys(battery).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Battery className="h-4 w-4" />
              Batterie
            </div>
            <div className="grid grid-cols-2 gap-2 pl-6 text-sm">
              {Object.entries(battery).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key}:</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connectivité */}
        {Object.keys(connectivity).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wifi className="h-4 w-4" />
              Connectivité
            </div>
            <div className="grid grid-cols-2 gap-2 pl-6 text-sm">
              {Object.entries(connectivity).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key}:</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conformité & Certifications */}
        <div className="space-y-2 pt-2 border-t">
          <div className="text-sm font-medium">Conformité & Certifications</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {hsCode?.code && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Code Douanier:</span>
                <Badge variant="outline" className="font-mono">HS {hsCode.code}</Badge>
              </div>
            )}
            
            {repairability?.score && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Indice Répar.:</span>
                <Badge variant={repairability.score >= 7 ? "default" : "outline"}>
                  {repairability.score}/10
                </Badge>
              </div>
            )}
            
            {environmental?.certifications && environmental.certifications.length > 0 && (
              <div className="col-span-2 space-y-1">
                <span className="text-muted-foreground text-xs">Certifications:</span>
                <div className="flex flex-wrap gap-1">
                  {environmental.certifications.map((cert, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {cert}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Autres spécifications */}
        {Object.keys(specs).length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-sm font-medium">Autres caractéristiques</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(specs).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key}:</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

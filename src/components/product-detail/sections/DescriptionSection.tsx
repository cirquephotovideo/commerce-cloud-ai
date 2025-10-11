import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Edit, Sparkles, CheckCircle2, XCircle } from "lucide-react";

interface DescriptionSectionProps {
  analysis: any;
}

export const DescriptionSection = ({ analysis }: DescriptionSectionProps) => {
  // Gérer le cas où description est un objet ou une chaîne
  const descriptionData = analysis?.analysis_result?.description;
  const description = typeof descriptionData === 'string' 
    ? descriptionData 
    : descriptionData?.suggested_description || 
      analysis?.analysis_result?.product_description ||
      analysis?.description ||
      'Aucune description disponible';
  
  const strengths = analysis?.analysis_result?.strengths || 
                    analysis?.analysis_result?.pros || [];
  
  const weaknesses = analysis?.analysis_result?.weaknesses || 
                     analysis?.analysis_result?.cons || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Description Complète
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description */}
        <div className="text-sm leading-relaxed">
          {description}
        </div>

        {/* Points forts */}
        {strengths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Points Forts
            </div>
            <div className="space-y-1 pl-6">
              {strengths.map((strength: string, index: number) => (
                <div key={index} className="text-sm flex items-start gap-2">
                  <span className="text-green-600">•</span>
                  <span>{strength}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Points faibles */}
        {weaknesses.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <XCircle className="h-4 w-4 text-red-600" />
              Points Faibles
            </div>
            <div className="space-y-1 pl-6">
              {weaknesses.map((weakness: string, index: number) => (
                <div key={index} className="text-sm flex items-start gap-2">
                  <span className="text-red-600">•</span>
                  <span>{weakness}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" className="gap-2">
            <Edit className="h-3 w-3" />
            Modifier
          </Button>
          <Button size="sm" variant="outline" className="gap-2">
            <Sparkles className="h-3 w-3" />
            Régénérer avec IA
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

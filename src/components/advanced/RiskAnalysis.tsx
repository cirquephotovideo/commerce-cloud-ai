import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

interface RiskAnalysisProps {
  initialUrl?: string;
}

export const RiskAnalysis = ({ initialUrl = "" }: RiskAnalysisProps) => {
  const [productUrl, setProductUrl] = useState(initialUrl);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!productUrl.trim()) {
      toast.error("Entrez une URL de produit");
      return;
    }

    setIsAnalyzing(true);
    
    const { data, error } = await supabase.functions.invoke('advanced-product-analyzer', {
      body: {
        productUrl,
        analysisTypes: ['risk'],
      }
    });

    setIsAnalyzing(false);

    if (error) {
      toast.error("Erreur d'analyse");
      return;
    }

    setAnalysis(data.results.risk);
    toast.success("Analyse des risques terminée");
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'default';
    }
  };

  const getComplianceIcon = (status: string) => {
    if (status.toLowerCase().includes('conforme') || status.toLowerCase().includes('ok')) {
      return <ShieldCheck className="w-4 h-4 text-green-500" />;
    }
    return <ShieldAlert className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Évaluation des Risques
          </CardTitle>
          <CardDescription>
            Conformité, garantie et authenticité
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL du Produit</Label>
            <Input
              placeholder="https://..."
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
            />
          </div>

          <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full">
            {isAnalyzing ? "Analyse en cours..." : "Analyser les Risques"}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Résultats</span>
              <Badge variant={getRiskColor(analysis.risk_level) as any}>
                Risque {analysis.risk_level}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Conformité Réglementaire</h3>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(analysis.compliance_status || {}).map(([norm, status]: [string, any]) => (
                  <div key={norm} className="flex items-center gap-2 p-2 border rounded">
                    {getComplianceIcon(status)}
                    <div>
                      <div className="text-sm font-medium">{norm}</div>
                      <div className="text-xs text-muted-foreground">{status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Score d'Authenticité</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${(analysis.authenticity_score || 0) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {((analysis.authenticity_score || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {analysis.warranty_analysis && (
              <div>
                <h3 className="font-semibold mb-2">Analyse Garantie</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coût estimé:</span>
                    <span className="font-medium">{analysis.warranty_analysis.cost_estimate}€</span>
                  </div>
                  {analysis.warranty_analysis.recommendations?.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Recommandations:</span>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        {analysis.warranty_analysis.recommendations.map((rec: string, i: number) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
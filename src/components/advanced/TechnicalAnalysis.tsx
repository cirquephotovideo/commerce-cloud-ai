import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, AlertTriangle, CheckCircle2 } from "lucide-react";

interface TechnicalAnalysisProps {
  initialUrl?: string;
}

export const TechnicalAnalysis = ({ initialUrl = "" }: TechnicalAnalysisProps) => {
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
        analysisTypes: ['technical'],
      }
    });

    setIsAnalyzing(false);

    if (error) {
      toast.error("Erreur d'analyse");
      return;
    }

    setAnalysis(data.results.technical);
    toast.success("Analyse technique terminée");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Analyse Technique Avancée
          </CardTitle>
          <CardDescription>
            Compatibilité, spécifications et obsolescence
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
            {isAnalyzing ? "Analyse en cours..." : "Analyser"}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de l'Analyse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Compatibilité
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Compatible avec:</span>
                  <ul className="list-disc list-inside ml-4">
                    {analysis.compatibility?.compatible?.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                {analysis.compatibility?.incompatible?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Incompatible avec:</span>
                    <ul className="list-disc list-inside ml-4">
                      {analysis.compatibility.incompatible.map((item: string, i: number) => (
                        <li key={i} className="text-red-500">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.compatibility?.required_accessories?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Accessoires requis:</span>
                    <ul className="list-disc list-inside ml-4">
                      {analysis.compatibility.required_accessories.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Cycle de Vie</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">Stade</div>
                  <div className="font-medium">{analysis.lifecycle_stage}</div>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">Score d'obsolescence</div>
                  <div className="font-medium">{(analysis.obsolescence_score * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>

            {Object.keys(analysis.compatibility?.regional_restrictions || {}).length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Restrictions Régionales
                </h3>
                <pre className="text-xs bg-muted p-2 rounded">
                  {JSON.stringify(analysis.compatibility.regional_restrictions, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
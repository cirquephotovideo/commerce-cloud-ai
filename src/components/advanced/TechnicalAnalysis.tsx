import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wrench, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TechnicalAnalysisProps {
  initialUrl?: string;
  platform?: string;
}

export const TechnicalAnalysis = ({ initialUrl = "", platform = "auto" }: TechnicalAnalysisProps) => {
  const [productUrl, setProductUrl] = useState(initialUrl);
  const [productName, setProductName] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [inputType, setInputType] = useState<"url" | "name" | "barcode">("url");
  const [analysis, setAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    const inputValue = inputType === "url" 
      ? productUrl 
      : inputType === "barcode" 
        ? barcodeInput 
        : productName;
    
    if (!inputValue.trim()) {
      toast.error(`Entrez ${inputType === "url" ? "une URL" : inputType === "name" ? "un nom" : "un code barres"} de produit`);
      return;
    }

    setIsAnalyzing(true);
    
    const { data, error } = await supabase.functions.invoke('advanced-product-analyzer', {
      body: {
        productInput: inputValue,
        inputType,
        analysisTypes: ['technical'],
        platform,
      }
    });

    setIsAnalyzing(false);

    if (error) {
      console.error('Erreur analyse:', error);
      toast.error("Erreur d'analyse : " + (error.message || "Erreur inconnue"));
      return;
    }

    if (data?.error) {
      console.error('Erreur dans les données:', data);
      toast.error("L'analyse a échoué : " + data.error);
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
          <Tabs value={inputType} onValueChange={(v) => setInputType(v as "url" | "name" | "barcode")}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="url">🔗 Par URL</TabsTrigger>
              <TabsTrigger value="name">📝 Par Nom</TabsTrigger>
              <TabsTrigger value="barcode">📷 Par Code Barres</TabsTrigger>
            </TabsList>
            
            <TabsContent value="url" className="space-y-4">
              <div>
                <Label>URL du Produit</Label>
                <Input
                  placeholder="https://..."
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="name" className="space-y-4">
              <div>
                <Label>Nom du Produit</Label>
                <Input
                  placeholder="Ex: iPhone 15 Pro Max"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="barcode" className="space-y-4">
              <div>
                <Label>Code-barres / EAN</Label>
                <Input
                  placeholder="Ex: 3700123456789"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full">
            {isAnalyzing ? "Analyse en cours..." : "Analyser"}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de l'Analyse</CardTitle>
            {analysis.product_name && (
              <p className="text-lg font-semibold text-primary">{analysis.product_name}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
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

            {/* Repairability & Eco Score */}
            {analysis.repairability && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  ♻️ Indice de Réparabilité & Éco-texte
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Score de réparabilité</div>
                    <div className="text-2xl font-bold text-green-600">{analysis.repairability.repairability_index || `${analysis.repairability.score}/10`}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Facilité de réparation</div>
                    <Badge variant="outline">{analysis.repairability.ease_of_repair}</Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Pièces détachées</div>
                    <div className="text-sm">{analysis.repairability.spare_parts_availability}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Durabilité</div>
                    <div className="font-medium">{analysis.repairability.durability_score}/10</div>
                  </div>
                </div>
              </div>
            )}

            {/* HS Code */}
            {analysis.hs_code && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  📦 Code Douanier (HS Code)
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-lg">{analysis.hs_code.code}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.hs_code.description}</p>
                </div>
              </div>
            )}

            {/* Environmental Impact */}
            {analysis.environmental_impact && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  🌱 Impact Environnemental
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Score écologique</div>
                      <div className="text-xl font-bold text-green-600">{analysis.environmental_impact.eco_score}/10</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Recyclabilité</div>
                      <div className="font-medium">{analysis.environmental_impact.recyclability_score}/10</div>
                    </div>
                  </div>
                  {analysis.environmental_impact.carbon_footprint && (
                    <div>
                      <div className="text-sm text-muted-foreground">Empreinte carbone</div>
                      <div className="text-sm">{analysis.environmental_impact.carbon_footprint}</div>
                    </div>
                  )}
                  {analysis.environmental_impact.eco_certifications?.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Certifications</div>
                      <div className="flex flex-wrap gap-2">
                        {analysis.environmental_impact.eco_certifications.map((cert: string, i: number) => (
                          <Badge key={i} variant="secondary">{cert}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.environmental_impact.energy_efficiency && (
                    <div>
                      <div className="text-sm text-muted-foreground">Efficacité énergétique</div>
                      <Badge variant="outline">{analysis.environmental_impact.energy_efficiency}</Badge>
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
import { TechnicalAnalysis } from "@/components/advanced/TechnicalAnalysis";
import { RiskAnalysis } from "@/components/advanced/RiskAnalysis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProductAdvancedTabProps {
  analysis: any;
}

export const ProductAdvancedTab = ({ analysis }: ProductAdvancedTabProps) => {
  const productUrl = analysis?.product_url || "";

  return (
    <Tabs defaultValue="technical" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="technical">Analyse Technique</TabsTrigger>
        <TabsTrigger value="risk">Analyse des Risques</TabsTrigger>
      </TabsList>

      <TabsContent value="technical" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Analyse Technique Complète</CardTitle>
            <CardDescription>
              Compatibilité, spécifications et cycle de vie du produit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TechnicalAnalysis initialUrl={productUrl} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="risk" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Évaluation des Risques</CardTitle>
            <CardDescription>
              Conformité, authenticité et garantie
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RiskAnalysis initialUrl={productUrl} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Database, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { OdooAttributesDisplay } from "@/components/OdooAttributesDisplay";
import { useEnrichment } from "@/hooks/useEnrichment";

interface OdooAttributesSectionProps {
  product: any;
  analysis?: any;
}

export const OdooAttributesSection = ({ product, analysis }: OdooAttributesSectionProps) => {
  const { mutate: triggerEnrichment, isPending } = useEnrichment(
    analysis?.id,
    () => window.location.reload()
  );

  const odooAttributes = analysis?.odoo_attributes;
  const category = analysis?.category;
  const isGenericCategory = category === 'generic';

  if (!odooAttributes || Object.keys(odooAttributes).length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Attributs Odoo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucun attribut Odoo enrichi pour ce produit.
            </AlertDescription>
          </Alert>
          
          <Button 
            onClick={() => triggerEnrichment({ enrichmentType: ['odoo_attributes'], webSearchEnabled: true })}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enrichissement en cours...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Enrichir avec Ollama Web Search
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {isGenericCategory && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Catégorie générique utilisée</AlertTitle>
          <AlertDescription>
            Ce produit a été enrichi avec des attributs génériques car sa catégorie spécifique n'a pas encore été configurée.
            Contactez votre administrateur pour ajouter des attributs spécifiques.
          </AlertDescription>
        </Alert>
      )}
      
      <OdooAttributesDisplay attributes={odooAttributes} category={category} />
    </div>
  );
};

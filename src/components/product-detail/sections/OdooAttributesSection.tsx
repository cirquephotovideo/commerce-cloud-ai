import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, AlertCircle } from "lucide-react";
import { OdooAttributesDisplay } from "@/components/OdooAttributesDisplay";

interface OdooAttributesSectionProps {
  product: any;
  analysis?: any;
}

export const OdooAttributesSection = ({ product, analysis }: OdooAttributesSectionProps) => {
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
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Aucun attribut Odoo enrichi. Cliquez sur "Enrichir Attributs Odoo" pour générer.</span>
          </div>
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

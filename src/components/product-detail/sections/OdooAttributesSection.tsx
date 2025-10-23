import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, AlertCircle } from "lucide-react";
import { OdooAttributesDisplay } from "@/components/OdooAttributesDisplay";

interface OdooAttributesSectionProps {
  product: any;
  analysis?: any;
}

export const OdooAttributesSection = ({ product, analysis }: OdooAttributesSectionProps) => {
  const odooAttributes = analysis?.odoo_attributes;
  const category = analysis?.category;

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

  return <OdooAttributesDisplay attributes={odooAttributes} category={category} />;
};

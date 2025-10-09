import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SupplierMappingConfigProps {
  supplierType: string;
  mapping: any;
  onMappingChange: (mapping: any) => void;
}

export function SupplierMappingConfig({ supplierType, mapping, onMappingChange }: SupplierMappingConfigProps) {
  const updateMapping = (key: string, value: string) => {
    onMappingChange({ ...mapping, [key]: value });
  };

  if (supplierType === 'api') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mapping des champs API</CardTitle>
          <CardDescription>
            Spécifiez le chemin des données dans la réponse JSON (ex: "product.barcode")
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="map_ean">EAN / Code-barres</Label>
              <Input
                id="map_ean"
                value={mapping?.ean || ''}
                onChange={(e) => updateMapping('ean', e.target.value)}
                placeholder="ean ou barcode"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="map_reference">Référence</Label>
              <Input
                id="map_reference"
                value={mapping?.reference || ''}
                onChange={(e) => updateMapping('reference', e.target.value)}
                placeholder="sku ou reference"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="map_name">Nom du produit</Label>
            <Input
              id="map_name"
              value={mapping?.name || ''}
              onChange={(e) => updateMapping('name', e.target.value)}
              placeholder="name ou title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="map_price">Prix d'achat</Label>
              <Input
                id="map_price"
                value={mapping?.price || ''}
                onChange={(e) => updateMapping('price', e.target.value)}
                placeholder="price ou cost_price"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="map_stock">Stock</Label>
              <Input
                id="map_stock"
                value={mapping?.stock || ''}
                onChange={(e) => updateMapping('stock', e.target.value)}
                placeholder="stock ou quantity"
              />
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Exemple de mapping :</p>
            <pre className="text-xs">
{`{
  "ean": "product.barcode",
  "name": "product.name",
  "price": "pricing.wholesale_price"
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

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

  if (supplierType === 'ftp' || supplierType === 'sftp') {
    const get = (field: string, key: string) => mapping?.[field]?.[key] ?? '';
    const updateCsvMap = (field: string, key: 'col' | 'sub' | 'subDelimiter' | 'decimal', value: any) => {
      const current = mapping?.[field] || {};
      onMappingChange({ ...mapping, [field]: { ...current, [key]: value } });
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Mapping CSV (FTP/SFTP)</CardTitle>
          <CardDescription>
            Indiquez l'index de colonne (0, 1, 2, ...) et facultativement un sous-champ si la cellule contient plusieurs valeurs séparées.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'product_name', label: 'Nom du produit' },
            { key: 'supplier_reference', label: 'Référence fournisseur' },
            { key: 'ean', label: 'EAN' },
            { key: 'stock_quantity', label: 'Stock' },
          ].map((f) => (
            <div key={f.key} className="grid grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Colonne ({f.label})</Label>
                <Input
                  type="number"
                  value={get(f.key, 'col')}
                  onChange={(e) => updateCsvMap(f.key, 'col', e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="ex: 0"
                />
              </div>
              <div className="space-y-2">
                <Label>Sous-champ (optionnel)</Label>
                <Input
                  type="number"
                  value={get(f.key, 'sub')}
                  onChange={(e) => updateCsvMap(f.key, 'sub', e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="ex: 1"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Séparateur des sous-champs</Label>
                <Input
                  value={get(f.key, 'subDelimiter') || ','}
                  onChange={(e) => updateCsvMap(f.key, 'subDelimiter', e.target.value)}
                  placeholder="," maxLength={1}
                />
              </div>
            </div>
          ))}

          <div className="grid grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label>Colonne (Prix d'achat)</Label>
              <Input
                type="number"
                value={get('purchase_price', 'col')}
                onChange={(e) => updateCsvMap('purchase_price', 'col', e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder="ex: 2"
              />
            </div>
            <div className="space-y-2">
              <Label>Sous-champ</Label>
              <Input
                type="number"
                value={get('purchase_price', 'sub')}
                onChange={(e) => updateCsvMap('purchase_price', 'sub', e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder="ex: 3"
              />
            </div>
            <div className="space-y-2">
              <Label>Séparateur</Label>
              <Input
                value={get('purchase_price', 'subDelimiter') || ','}
                onChange={(e) => updateCsvMap('purchase_price', 'subDelimiter', e.target.value)}
                placeholder="," maxLength={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Décimal</Label>
              <Input
                value={get('purchase_price', 'decimal') || ','}
                onChange={(e) => updateCsvMap('purchase_price', 'decimal', e.target.value)}
                placeholder="," maxLength={1}
              />
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">💡 Exemple avec sous-champs séparés par "/"</p>
            <p className="text-xs text-muted-foreground mb-2">
              Si votre CSV contient : <code>0.6/2.8,V1319,...</code> (produit/référence dans col 0)
            </p>
            <pre className="text-xs overflow-x-auto">
{`{
  "product_name": { "col": 0, "sub": 0, "subDelimiter": "/" },
  "supplier_reference": { "col": 0, "sub": 1, "subDelimiter": "/" },
  "ean": { "col": 3 },
  "stock_quantity": { "col": 4 },
  "purchase_price": { "col": 6, "decimal": "." }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

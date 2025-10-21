import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { Search, DollarSign, Info, Eye } from 'lucide-react';
import { toast } from 'sonner';

export const ProductAnalysisConfig = () => {
  const { updateConfiguration, state } = useWizard();
  const [ean, setEan] = useState(state.configuration.ean || '');
  const [productUrl, setProductUrl] = useState(state.configuration.productUrl || '');
  const [purchasePrice, setPurchasePrice] = useState(state.configuration.purchasePrice || '');
  const [isValidEan, setIsValidEan] = useState<boolean | null>(null);

  const validateEan = (value: string) => {
    const eanRegex = /^\d{8,13}$/;
    const isValid = eanRegex.test(value);
    setIsValidEan(value ? isValid : null);
    return isValid;
  };

  const handleEanChange = (value: string) => {
    setEan(value);
    validateEan(value);
    updateConfiguration({ ean: value, productUrl: '' });
  };

  const handleUrlChange = (value: string) => {
    setProductUrl(value);
    updateConfiguration({ productUrl: value, ean: '' });
  };

  const handlePriceChange = (value: string) => {
    setPurchasePrice(value);
    updateConfiguration({ purchasePrice: parseFloat(value) || 0 });
  };

  const handlePreview = () => {
    if (!ean && !productUrl) {
      toast.error('Veuillez renseigner un EAN ou une URL');
      return;
    }
    
    if (ean && !validateEan(ean)) {
      toast.error('Format EAN invalide (8 à 13 chiffres requis)');
      return;
    }

    toast.info('Lancement de la prévisualisation...');
    // TODO: Déclencher l'analyse et afficher dans ResultsPanel
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Analyse de produit</h3>
        <p className="text-sm text-muted-foreground">
          Renseignez un EAN ou une URL pour analyser un produit
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-5 w-5" />
            Identification du produit
          </CardTitle>
          <CardDescription>Choisissez une méthode d'identification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="ean">EAN / GTIN</Label>
            <Input
              id="ean"
              placeholder="Ex: 3700086881654"
              value={ean}
              onChange={(e) => handleEanChange(e.target.value)}
              className={
                isValidEan === false
                  ? 'border-destructive'
                  : isValidEan === true
                  ? 'border-primary'
                  : ''
              }
              disabled={!!productUrl}
            />
            {isValidEan === false && (
              <p className="text-xs text-destructive mt-1">
                Format invalide (8 à 13 chiffres requis)
              </p>
            )}
            {isValidEan === true && (
              <p className="text-xs text-primary mt-1">✓ EAN valide</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex-1 border-t" />
            <span>OU</span>
            <div className="flex-1 border-t" />
          </div>

          <div>
            <Label htmlFor="url">URL du produit</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://www.amazon.fr/dp/..."
              value={productUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={!!ean}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Fonctionne avec Amazon, eBay, et la plupart des sites e-commerce
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Informations commerciales (optionnel)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="price">Prix d'achat fournisseur (€)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              placeholder="Ex: 12.50"
              value={purchasePrice}
              onChange={(e) => handlePriceChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Permet de calculer automatiquement les marges et prix de vente suggérés
            </p>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          L'analyse enrichira automatiquement le produit avec : spécifications techniques, 
          images, descriptions multilingues, données Amazon, et analyse IA
        </AlertDescription>
      </Alert>

      <Button 
        variant="outline" 
        className="w-full" 
        onClick={handlePreview}
        disabled={!ean && !productUrl}
      >
        <Eye className="h-4 w-4 mr-2" />
        Prévisualiser l'analyse
      </Button>
    </div>
  );
};

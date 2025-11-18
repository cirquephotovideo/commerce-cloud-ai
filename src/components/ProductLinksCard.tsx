import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link2, Loader2, ExternalLink, Trash2, Zap } from 'lucide-react';
import { useProductLinks } from '@/hooks/useProductLinks';
import { Alert, AlertDescription } from './ui/alert';

interface ProductLinksCardProps {
  analysisId: string;
}

/**
 * Phase C.2: Composant pour afficher et gérer les liens produits
 */
export function ProductLinksCard({ analysisId }: ProductLinksCardProps) {
  const { links, isLoading, error, deleteLink, autoLink } = useProductLinks(analysisId);

  const getConfidenceBadgeVariant = (score: number) => {
    if (score >= 95) return 'default';
    if (score >= 70) return 'secondary';
    return 'outline';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Liens Fournisseurs
            </CardTitle>
            <CardDescription>
              Produits fournisseurs liés automatiquement ou manuellement
            </CardDescription>
          </div>
          <Button
            onClick={autoLink}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Auto-Link
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && links.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucun lien fournisseur trouvé</p>
            <p className="text-xs mt-1">Cliquez sur "Auto-Link" pour rechercher des correspondances</p>
          </div>
        )}

        {!isLoading && links.length > 0 && (
          <div className="space-y-3">
            {links.map(link => (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">
                      {link.supplier_product?.name || 'Nom inconnu'}
                    </p>
                    <Badge variant={getConfidenceBadgeVariant(link.confidence_score * 100)}>
                      {Math.round(link.confidence_score * 100)}%
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {link.link_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Réf: {link.supplier_product?.supplier_reference || 'N/A'}</span>
                    {link.supplier_product?.purchase_price && (
                      <span className="font-medium text-foreground">
                        {link.supplier_product.purchase_price.toFixed(2)}€
                      </span>
                    )}
                    {link.supplier_product?.stock_quantity !== null && (
                      <span>Stock: {link.supplier_product.stock_quantity}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteLink(link.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
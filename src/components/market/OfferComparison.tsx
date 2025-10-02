import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, TrendingDown, CheckCircle2 } from "lucide-react";

interface Offer {
  product_name: string;
  current_price: number;
  product_url: string;
  image_url?: string;
  stock_status?: string;
  rating?: number;
  search_engine: string;
  confidence_score: number;
  search_metadata?: any;
  created_at: string;
}

interface OfferComparisonProps {
  offers: Offer[];
}

export const OfferComparison = ({ offers }: OfferComparisonProps) => {
  if (offers.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Aucune offre disponible pour comparaison
        </CardContent>
      </Card>
    );
  }

  // Group offers by merchant (extracted from URL)
  const offersByMerchant = offers.reduce((acc, offer) => {
    const url = new URL(offer.product_url);
    const merchant = url.hostname.replace('www.', '');
    
    if (!acc[merchant]) {
      acc[merchant] = [];
    }
    acc[merchant].push(offer);
    return acc;
  }, {} as Record<string, Offer[]>);

  // Calculate best price
  const allPrices = offers.map(o => o.current_price);
  const bestPrice = Math.min(...allPrices);
  const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Comparaison des Offres</span>
          <Badge variant="secondary">{offers.length} offres trouvées</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marchand</TableHead>
              <TableHead className="text-center">Google CSE</TableHead>
              <TableHead className="text-center">Serper.dev</TableHead>
              <TableHead className="text-center">Prix</TableHead>
              <TableHead className="text-center">Écart</TableHead>
              <TableHead className="text-center">Confiance</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(offersByMerchant).map(([merchant, merchantOffers]) => {
              const googleOffer = merchantOffers.find(o => o.search_engine === 'google' || o.search_engine === 'dual');
              const serperOffer = merchantOffers.find(o => o.search_engine === 'serper' || o.search_engine === 'dual');
              const dualValidated = merchantOffers.some(o => o.search_engine === 'dual');
              
              const bestOfferPrice = Math.min(...merchantOffers.map(o => o.current_price));
              const isBestPrice = bestOfferPrice === bestPrice;
              const priceVariation = ((bestOfferPrice - avgPrice) / avgPrice) * 100;

              const mainOffer = googleOffer || serperOffer!;
              const metadata = mainOffer.search_metadata as any;
              const isPromo = metadata?.is_promo || false;

              return (
                <TableRow key={merchant} className={isBestPrice ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{merchant}</span>
                      {dualValidated && (
                        <Badge variant="outline" className="w-fit">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Validé 2 sources
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {googleOffer ? (
                      <Badge variant="secondary">{googleOffer.current_price.toFixed(2)}€</Badge>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {serperOffer ? (
                      <Badge variant="secondary">{serperOffer.current_price.toFixed(2)}€</Badge>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-bold text-lg ${isBestPrice ? 'text-green-600' : ''}`}>
                        {bestOfferPrice.toFixed(2)}€
                      </span>
                      {isBestPrice && (
                        <Badge variant="default" className="bg-green-600">
                          Meilleur prix
                        </Badge>
                      )}
                      {isPromo && (
                        <Badge variant="destructive" className="animate-pulse">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          PROMO
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={priceVariation > 0 ? 'text-red-600' : 'text-green-600'}>
                      {priceVariation > 0 ? '+' : ''}{priceVariation.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {(mainOffer.confidence_score * 100).toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <a
                      href={mainOffer.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Voir
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Prix moyen</p>
              <p className="text-2xl font-bold">{avgPrice.toFixed(2)}€</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Meilleur prix</p>
              <p className="text-2xl font-bold text-green-600">{bestPrice.toFixed(2)}€</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Économie max</p>
              <p className="text-2xl font-bold text-green-600">
                {(avgPrice - bestPrice).toFixed(2)}€
              </p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

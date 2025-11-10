import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Package, DollarSign, TrendingUp } from "lucide-react";

interface Code2AsinData {
  asin?: string;
  title?: string;
  brand?: string;
  manufacturer?: string;
  buybox_price?: number;
  buybox_seller_name?: string;
  buybox_is_fba?: boolean;
  buybox_is_amazon?: boolean;
  amazon_price?: number;
  lowest_fba_new?: number;
  lowest_new?: number;
  lowest_used?: number;
  list_price?: number;
  item_length_cm?: number;
  item_width_cm?: number;
  item_height_cm?: number;
  item_weight_g?: number;
  package_length_cm?: number;
  package_width_cm?: number;
  package_height_cm?: number;
  package_weight_g?: number;
  offer_count_new?: number;
  offer_count_used?: number;
  referral_fee_percentage?: number;
  fulfillment_fee?: number;
  sales_rank?: string;
  color?: string;
  size?: string;
  marketplace?: string;
}

export const Code2AsinSection = ({ enrichmentData }: { enrichmentData?: Code2AsinData }) => {
  if (!enrichmentData) return null;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Données Code2ASIN
          <Badge variant="secondary">Enrichi</Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Identifiants Amazon */}
        {enrichmentData.asin && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Identifiants Amazon
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">ASIN</span>
                <p className="font-mono font-semibold">{enrichmentData.asin}</p>
              </div>
              {enrichmentData.marketplace && (
                <div>
                  <span className="text-sm text-muted-foreground">Marketplace</span>
                  <p className="font-semibold">{enrichmentData.marketplace}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Prix & Buy Box */}
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pricing Amazon
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {enrichmentData.buybox_price && (
              <div className="p-3 bg-primary/5 rounded-lg">
                <span className="text-sm text-muted-foreground">Prix Buy Box</span>
                <p className="font-semibold text-lg">{enrichmentData.buybox_price.toFixed(2)}€</p>
                {enrichmentData.buybox_seller_name && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {enrichmentData.buybox_seller_name}
                  </p>
                )}
                {enrichmentData.buybox_is_fba && (
                  <Badge variant="outline" className="mt-1">FBA</Badge>
                )}
                {enrichmentData.buybox_is_amazon && (
                  <Badge variant="outline" className="mt-1">Amazon</Badge>
                )}
              </div>
            )}
            
            {enrichmentData.amazon_price && (
              <div className="p-3 bg-accent/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Prix Amazon</span>
                <p className="font-semibold text-lg">{enrichmentData.amazon_price.toFixed(2)}€</p>
              </div>
            )}
            
            {enrichmentData.lowest_fba_new && (
              <div className="p-3 bg-accent/50 rounded-lg">
                <span className="text-sm text-muted-foreground">FBA Min Neuf</span>
                <p className="font-semibold text-lg">{enrichmentData.lowest_fba_new.toFixed(2)}€</p>
              </div>
            )}
            
            {enrichmentData.list_price && (
              <div className="p-3 bg-accent/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Prix catalogue</span>
                <p className="font-semibold text-lg">{enrichmentData.list_price.toFixed(2)}€</p>
              </div>
            )}
            
            {enrichmentData.lowest_new && (
              <div className="p-3 bg-accent/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Min Neuf</span>
                <p className="font-semibold">{enrichmentData.lowest_new.toFixed(2)}€</p>
              </div>
            )}
            
            {enrichmentData.lowest_used && (
              <div className="p-3 bg-accent/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Min Occasion</span>
                <p className="font-semibold">{enrichmentData.lowest_used.toFixed(2)}€</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Dimensions */}
        {(enrichmentData.item_length_cm || enrichmentData.package_length_cm) && (
          <div>
            <h4 className="font-semibold mb-2">📦 Dimensions & Poids</h4>
            <div className="grid grid-cols-2 gap-4">
              {enrichmentData.item_length_cm && (
                <div className="p-3 border rounded-lg">
                  <span className="text-sm text-muted-foreground">Article</span>
                  <p className="font-mono">
                    {enrichmentData.item_length_cm} × {enrichmentData.item_width_cm} × {enrichmentData.item_height_cm} cm
                  </p>
                  {enrichmentData.item_weight_g && (
                    <p className="text-sm text-muted-foreground">{enrichmentData.item_weight_g}g</p>
                  )}
                </div>
              )}
              
              {enrichmentData.package_length_cm && (
                <div className="p-3 border rounded-lg">
                  <span className="text-sm text-muted-foreground">Emballage</span>
                  <p className="font-mono">
                    {enrichmentData.package_length_cm} × {enrichmentData.package_width_cm} × {enrichmentData.package_height_cm} cm
                  </p>
                  {enrichmentData.package_weight_g && (
                    <p className="text-sm text-muted-foreground">{enrichmentData.package_weight_g}g</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Offres */}
        {(enrichmentData.offer_count_new || enrichmentData.offer_count_used) && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Offres concurrentes
            </h4>
            <div className="flex flex-wrap gap-2">
              {enrichmentData.offer_count_new && (
                <Badge variant="default">Neuf: {enrichmentData.offer_count_new}</Badge>
              )}
              {enrichmentData.offer_count_used && (
                <Badge variant="outline">Occasion: {enrichmentData.offer_count_used}</Badge>
              )}
            </div>
          </div>
        )}
        
        {/* Frais Amazon */}
        {(enrichmentData.referral_fee_percentage || enrichmentData.fulfillment_fee) && (
          <div>
            <h4 className="font-semibold mb-2">💵 Frais Amazon</h4>
            <div className="grid grid-cols-2 gap-4">
              {enrichmentData.referral_fee_percentage && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <span className="text-sm text-muted-foreground">Commission référencement</span>
                  <p className="font-semibold text-lg">{enrichmentData.referral_fee_percentage.toFixed(2)}%</p>
                </div>
              )}
              
              {enrichmentData.fulfillment_fee && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <span className="text-sm text-muted-foreground">Frais logistique FBA</span>
                  <p className="font-semibold text-lg">{enrichmentData.fulfillment_fee.toFixed(2)}€</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Caractéristiques */}
        {(enrichmentData.color || enrichmentData.size || enrichmentData.sales_rank) && (
          <div>
            <h4 className="font-semibold mb-2">ℹ️ Caractéristiques</h4>
            <div className="grid grid-cols-2 gap-4">
              {enrichmentData.color && (
                <div>
                  <span className="text-sm text-muted-foreground">Couleur</span>
                  <p>{enrichmentData.color}</p>
                </div>
              )}
              {enrichmentData.size && (
                <div>
                  <span className="text-sm text-muted-foreground">Taille</span>
                  <p>{enrichmentData.size}</p>
                </div>
              )}
              {enrichmentData.sales_rank && (
                <div className="col-span-2">
                  <span className="text-sm text-muted-foreground">Rangs de vente</span>
                  <p className="text-sm">{enrichmentData.sales_rank}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

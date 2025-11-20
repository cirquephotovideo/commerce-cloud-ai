import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Truck, Edit, AlertCircle, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useSupplierPricesRealtime } from "@/hooks/useSupplierPricesRealtime";
import { useSupplierSync } from "@/hooks/useSupplierSync";
import { cn } from "@/lib/utils";

interface CriticalInfoSectionProps {
  product: any;
  analysis?: any;
  supplierCount?: number;
  onUpdate?: () => void;
}

export const CriticalInfoSection = ({ 
  product, 
  analysis,
  supplierCount = 0,
  onUpdate 
}: CriticalInfoSectionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState(product?.purchase_price || analysis?.purchase_price || '');
  const [sellingPrice, setSellingPrice] = useState(
    analysis?.analysis_result?.price || 
    analysis?.analysis_result?.selling_price || 
    analysis?.analysis_result?.recommended_price || 
    ''
  );

  // Récupérer les données des fournisseurs en temps réel
  const { prices: supplierPrices, isLoading: isLoadingSuppliers, refetch } = useSupplierPricesRealtime(analysis?.id);
  const { cleanupAndResync, isCleaning } = useSupplierSync();

  // Logs de débogage
  console.log('[CriticalInfoSection] 🔍 Debug Info:', {
    analysisId: analysis?.id,
    supplierCount,
    supplierPrices: supplierPrices?.length || 0,
    isLoadingSuppliers,
    prices: supplierPrices
  });

  // PHASE 4: Récupérer le meilleur prix fournisseur
  const { data: bestPrice } = useQuery({
    queryKey: ['best-supplier-price', analysis?.id],
    queryFn: async () => {
      if (!analysis?.id) return null;
      const { data } = await supabase
        .from('supplier_price_variants')
        .select('purchase_price, suggested_selling_price, suggested_margin_percent, supplier_id, supplier_name')
        .eq('analysis_id', analysis.id)
        .gt('stock_quantity', 0)
        .order('purchase_price', { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!analysis?.id
  });

  const calculateMargin = () => {
    const purchase = parseFloat(purchasePrice) || 0;
    const selling = parseFloat(sellingPrice) || 0;
    if (purchase === 0 || selling === 0) return null;
    return ((selling - purchase) / purchase * 100).toFixed(2);
  };

  const margin = calculateMargin();

  // Fix: Vérifier correctement si les prix sont vides ou nuls
  const hasPurchasePrice = purchasePrice && purchasePrice !== '' && parseFloat(purchasePrice) > 0;
  const hasSellingPrice = sellingPrice && sellingPrice !== '' && parseFloat(sellingPrice) > 0;

  // Affichage conditionnel quand aucun fournisseur et pas de prix saisis
  if (supplierCount === 0 && !hasPurchasePrice && !hasSellingPrice) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
            <DollarSign className="w-16 h-16 text-muted-foreground/40" />
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                📊 Informations Critiques
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Aucun prix fournisseur disponible pour ce produit
              </p>
              <p className="text-xs text-muted-foreground/60">
                Liez des fournisseurs dans l'onglet "Fournisseurs" pour voir les prix d'achat et calculer les marges
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                const suppliersSection = document.getElementById('section-suppliers');
                if (suppliersSection) {
                  suppliersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="mt-2"
            >
              <Truck className="w-4 h-4 mr-2" />
              Lier des fournisseurs
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getMarginBadge = (marginValue: string | null) => {
    if (!marginValue) return null;
    const marginNum = parseFloat(marginValue);
    if (marginNum >= 30) return <Badge className="bg-green-600">🟢 Excellente</Badge>;
    if (marginNum >= 20) return <Badge className="bg-yellow-600">🟡 Bonne</Badge>;
    return <Badge className="bg-red-600">🔴 Faible</Badge>;
  };

  const handleSave = async () => {
    try {
      // Save to product_analyses if analysis exists
      if (analysis?.id) {
        const { error } = await supabase
          .from('product_analyses')
          .update({
            purchase_price: parseFloat(purchasePrice) || null,
            analysis_result: {
              ...analysis.analysis_result,
              selling_price: parseFloat(sellingPrice) || null,
              recommended_price: parseFloat(sellingPrice) || null
            }
          })
          .eq('id', analysis.id);

        if (error) throw error;
      }

      toast.success('Prix mis à jour avec succès');
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving prices:', error);
      toast.error('Erreur lors de la sauvegarde des prix');
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20 shadow-lg">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-primary">📊 Informations Critiques</h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="h-4 w-4 mr-1" />
            {isEditing ? 'Annuler' : 'Modifier'}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Prix d'achat */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>Prix d'Achat</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                className="h-14 text-2xl font-bold"
              />
            ) : (
              <div className="text-3xl font-bold">
                {purchasePrice ? `${parseFloat(purchasePrice).toFixed(2)}€` : 'N/A'}
              </div>
            )}
          </div>

          {/* Prix de vente */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Prix de Vente</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
                className="h-14 text-2xl font-bold"
              />
            ) : (
              <div className="text-3xl font-bold text-primary">
                {sellingPrice ? `${parseFloat(sellingPrice).toFixed(2)}€` : 'N/A'}
              </div>
            )}
          </div>

          {/* Marge */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Marge</div>
            <div className="flex flex-col gap-2">
              <div className="text-3xl font-bold">
                {margin ? `${margin}%` : 'N/A'}
              </div>
              {getMarginBadge(margin)}
            </div>
          </div>

          {/* Fournisseurs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span>Fournisseurs</span>
              {supplierPrices && supplierPrices.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {supplierPrices.length} lié(s)
                </Badge>
              )}
            </div>

            {isLoadingSuppliers ? (
              <div className="text-sm text-muted-foreground">Chargement...</div>
            ) : !supplierPrices || supplierPrices.length === 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Aucun fournisseur lié
                </div>
                {supplierCount > 0 && (
                  <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">
                ⚠️ Erreur de chargement
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetch()}
                disabled={isLoadingSuppliers}
                className="h-6 px-2 text-xs"
              >
                <RefreshCcw className={cn(
                  "h-3 w-3 mr-1",
                  isLoadingSuppliers && "animate-spin"
                )} />
                Recharger
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => cleanupAndResync.mutate({ resyncOdoo: true })}
                disabled={isCleaning}
                className="h-6 px-2 text-xs"
              >
                <AlertCircle className={cn(
                  "h-3 w-3 mr-1",
                  isCleaning && "animate-spin"
                )} />
                {isCleaning ? 'Réparation...' : 'Réparer'}
              </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {supplierPrices.map((s) => {
                  const hasPrice = !!s.purchase_price && s.purchase_price > 0;
                  const hasStock = (s.stock_quantity ?? 0) > 0;
                  const lowStock = hasStock && (s.stock_quantity ?? 0) < 5;
                  
                  return (
                    <div key={s.id} className="flex items-start justify-between text-xs border-b border-border/50 pb-1.5 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium" title={s.supplier_name}>
                          {s.supplier_name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {!hasPrice && (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1">
                              ⚠️ Prix manquant
                            </Badge>
                          )}
                          {!hasStock && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-muted">
                              Pas de stock
                            </Badge>
                          )}
                          {lowStock && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 border-orange-500 text-orange-500">
                              Stock faible
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-[10px] whitespace-nowrap">
                        <span className={`font-semibold ${hasPrice ? 'text-primary' : 'text-muted-foreground'}`}>
                          {hasPrice ? `${s.purchase_price.toFixed(2)}€` : "N/A"}
                        </span>
                        <span className="text-muted-foreground">
                          Stock: {s.stock_quantity ?? 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button onClick={handleSave} size="lg">
              Enregistrer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

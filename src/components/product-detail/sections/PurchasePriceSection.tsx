import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, RefreshCw, AlertTriangle, XCircle } from "lucide-react";
import { useSupplierPricesRealtime } from "@/hooks/useSupplierPricesRealtime";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface PurchasePriceSectionProps {
  analysisId: string;
}

export const PurchasePriceSection = ({ analysisId }: PurchasePriceSectionProps) => {
  const { prices: suppliers, isLoading, refetch } = useSupplierPricesRealtime(analysisId);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSyncPrice = async (supplierProductId: string) => {
    setSyncingId(supplierProductId);
    try {
      const { error } = await supabase.functions.invoke('supplier-sync-single-product', {
        body: { productId: supplierProductId }
      });
      
      if (error) throw error;
      
      toast.success('Prix synchronisé avec succès');
      refetch();
    } catch (error: any) {
      console.error('Erreur synchro prix:', error);
      toast.error('Erreur lors de la synchronisation du prix');
    } finally {
      setSyncingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Prix d'Achat par Fournisseur
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  if (!suppliers || suppliers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Prix d'Achat par Fournisseur
          </CardTitle>
          <CardDescription>
            Aucun fournisseur lié à ce produit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aucun fournisseur n'est actuellement lié à ce produit.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="w-full" onClick={() => {
                // Navigate to suppliers tab or show supplier link dialog
                window.location.href = '/suppliers';
              }}>
                Lier un fournisseur
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedSuppliers = [...suppliers].sort((a, b) => {
    // Si les deux ont un prix, on trie par prix
    if (a.purchase_price > 0 && b.purchase_price > 0) {
      return a.purchase_price - b.purchase_price;
    }
    // Si un seul a un prix, celui-là vient en premier
    if (a.purchase_price > 0) return -1;
    if (b.purchase_price > 0) return 1;
    // Si aucun n'a de prix, on garde l'ordre
    return 0;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Prix d'Achat par Fournisseur
        </CardTitle>
        <CardDescription>
          {suppliers.length} fournisseur{suppliers.length > 1 ? 's' : ''} actif{suppliers.length > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedSuppliers.map((supplier, index) => {
            const hasMissingPrice = !supplier.purchase_price || supplier.purchase_price === 0;
            const hasLowStock = supplier.stock_quantity !== null && supplier.stock_quantity < 50 && supplier.stock_quantity > 0;
            const hasNoStock = supplier.stock_quantity === 0 || supplier.stock_quantity === null;
            
            return (
              <div key={supplier.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                    {!hasMissingPrice && index === 0 && '🥇'}
                    {!hasMissingPrice && index === 1 && '🥈'}
                    {!hasMissingPrice && index === 2 && '🥉'}
                    {(!hasMissingPrice && index > 2) && `#${index + 1}`}
                    {hasMissingPrice && '⚠️'}
        </div>
        
        {suppliers.some(s => !s.purchase_price || s.purchase_price === 0) && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p>⚠️ Certains fournisseurs n'ont pas encore de prix renseigné.</p>
            <p className="mt-1">Cliquez sur <RefreshCw className="h-3 w-3 inline" /> pour synchroniser les prix depuis vos catalogues.</p>
          </div>
        )}
                  <div>
                    <div className="font-medium">{supplier.supplier_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {supplier.last_updated && formatDistanceToNow(new Date(supplier.last_updated), {
                        addSuffix: true,
                        locale: fr
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasMissingPrice ? (
                    <Badge variant="outline" className="text-warning">
                      ⚠️ Prix manquant
                    </Badge>
                  ) : (
                    <Badge variant={index === 0 ? "default" : "outline"} className="text-base px-3 py-1">
                      {supplier.purchase_price.toFixed(2)}€
                    </Badge>
                  )}
                  
                  {supplier.stock_quantity !== null && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      Stock: {supplier.stock_quantity}
                      {hasNoStock && <XCircle className="h-3 w-3 text-destructive" />}
                      {hasLowStock && <AlertTriangle className="h-3 w-3 text-warning" />}
                    </Badge>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSyncPrice(supplier.id)}
                    disabled={syncingId === supplier.id}
                    title="Synchroniser le prix"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncingId === supplier.id ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SupplierPrice {
  id: string;
  supplier_name: string;
  supplier_id: string;
  supplier_product_id?: string;
  supplier_type?: string;
  supplier_reference?: string;
  purchase_price: number;
  currency: string;
  stock_quantity: number | null;
  last_updated: string;
  price_change_percentage?: number;
  is_price_missing?: boolean;
}

interface RecentChange {
  supplier_name: string;
  old_price: number;
  new_price: number;
  change_percentage: number;
}

export const useSupplierPricesRealtime = (analysisId: string) => {
  const [prices, setPrices] = useState<SupplierPrice[]>([]);
  const [bestPrice, setBestPrice] = useState<SupplierPrice | null>(null);
  const [recentChanges, setRecentChanges] = useState<RecentChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrices = async () => {
    // Guard clause: vérifier que analysisId est valide
    if (!analysisId) {
      console.log('[useSupplierPricesRealtime] ⚠️ No valid analysisId provided, skipping fetch');
      setPrices([]);
      setBestPrice(null);
      setIsLoading(false);
      return;
    }

    try {
      console.log('[useSupplierPricesRealtime] 🔍 Fetching prices for analysisId:', analysisId);
      
      // LIRE DIRECTEMENT supplier_price_variants au lieu de faire JOIN compliqué
      const { data: variants, error: variantsError } = await supabase
        .from('supplier_price_variants')
        .select(`
          id,
          supplier_id,
          supplier_product_id,
          purchase_price,
          stock_quantity,
          currency,
          last_updated,
          supplier_configurations(supplier_name, supplier_type),
          supplier_products(supplier_reference)
        `)
        .eq('analysis_id', analysisId)
        .order('purchase_price', { ascending: true, nullsFirst: false });

      if (variantsError) throw variantsError;

      console.log('[useSupplierPricesRealtime] 📊 Supplier price variants found:', variants?.length || 0);

      if (variants && variants.length > 0) {
        const formattedPrices = variants.map((item: any) => ({
          id: item.id,
          supplier_id: item.supplier_id,
          supplier_product_id: item.supplier_product_id,
          supplier_name: item.supplier_configurations?.supplier_name || 'Fournisseur inconnu',
          supplier_type: item.supplier_configurations?.supplier_type,
          supplier_reference: item.supplier_products?.supplier_reference,
          purchase_price: item.purchase_price || 0,
          currency: item.currency || 'EUR',
          stock_quantity: item.stock_quantity ?? 0,
          last_updated: item.last_updated,
          is_price_missing: !item.purchase_price || item.purchase_price === 0,
        }));
        
        console.log('[useSupplierPricesRealtime] ✅ Formatted prices:', formattedPrices.map(p => ({
          supplier: p.supplier_name,
          price: p.purchase_price,
          stock: p.stock_quantity
        })));
        
        setPrices(formattedPrices);
        setBestPrice(formattedPrices.find(p => p.purchase_price > 0) || formattedPrices[0]);
      } else {
        console.log('[useSupplierPricesRealtime] ⚠️ No supplier price variants found');
        setPrices([]);
        setBestPrice(null);
      }
    } catch (error) {
      console.error('[useSupplierPricesRealtime] ❌ Error fetching supplier prices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();

    // S'abonner aux changements en temps réel sur supplier_price_variants
    const channel = supabase
      .channel(`supplier-prices-${analysisId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supplier_price_variants',
          filter: `analysis_id=eq.${analysisId}`,
        },
        (payload) => {
          console.log('Supplier price variant change detected:', payload);
          fetchPrices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [analysisId]);

  return { 
    prices, 
    bestPrice, 
    recentChanges, 
    isLoading, 
    refetch: fetchPrices 
  };
};

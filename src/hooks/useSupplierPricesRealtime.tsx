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
    try {
      console.log('[useSupplierPricesRealtime] 🔍 Fetching prices for analysisId:', analysisId);
      
      // First get the product links to get supplier_product_id
      const { data: links, error: linksError } = await supabase
        .from('product_links')
        .select('supplier_product_id')
        .eq('analysis_id', analysisId);

      if (linksError) throw linksError;

      console.log('[useSupplierPricesRealtime] 📦 Product links found:', links?.length || 0);

      if (!links || links.length === 0) {
        console.log('[useSupplierPricesRealtime] ⚠️ No product links found');
        setPrices([]);
        setBestPrice(null);
        setIsLoading(false);
        return;
      }

      const supplierProductIds = links.map(l => l.supplier_product_id);
      console.log('[useSupplierPricesRealtime] 🔗 Supplier product IDs:', supplierProductIds);

      // Get supplier products with prices
      const { data: products, error: productsError } = await supabase
        .from('supplier_products')
        .select(`
          id,
          supplier_id,
          supplier_reference,
          purchase_price,
          stock_quantity,
          last_updated,
          supplier_configurations(supplier_name, supplier_type)
        `)
        .in('id', supplierProductIds)
        .order('purchase_price', { ascending: true, nullsFirst: false });

      if (productsError) throw productsError;

      console.log('[useSupplierPricesRealtime] 📊 Supplier products found:', products?.length || 0);

      if (products && products.length > 0) {
        const formattedPrices = products.map((item: any) => ({
          id: item.id,
          supplier_id: item.supplier_id,
          supplier_product_id: item.id,
          supplier_name: item.supplier_configurations?.supplier_name || 'Fournisseur inconnu',
          supplier_type: item.supplier_configurations?.supplier_type,
          supplier_reference: item.supplier_reference,
          purchase_price: item.purchase_price || 0,
          currency: 'EUR',
          stock_quantity: item.stock_quantity ?? 0,
          last_updated: item.last_updated,
          is_price_missing: !item.purchase_price || item.purchase_price === 0,
        }));
        
        console.log('[useSupplierPricesRealtime] ✅ Formatted prices:', formattedPrices.map(p => ({
          supplier: p.supplier_name,
          price: p.purchase_price,
          is_missing: p.is_price_missing,
          stock: p.stock_quantity
        })));
        
        setPrices(formattedPrices);
        // Le meilleur prix est le premier avec un prix > 0, sinon le premier de la liste
        setBestPrice(formattedPrices.find(p => p.purchase_price > 0) || formattedPrices[0]);
      } else {
        console.log('[useSupplierPricesRealtime] ⚠️ No supplier products returned');
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

    // S'abonner aux changements en temps réel
    const channel = supabase
      .channel(`supplier-prices-${analysisId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supplier_products',
        },
        (payload) => {
          console.log('Supplier product change detected:', payload);
          fetchPrices();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_links',
          filter: `analysis_id=eq.${analysisId}`,
        },
        (payload) => {
          console.log('Link change detected:', payload);
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

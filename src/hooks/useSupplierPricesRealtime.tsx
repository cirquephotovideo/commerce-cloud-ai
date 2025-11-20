import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SupplierPrice {
  id: string;
  supplier_name: string;
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
      // First get the product links to get supplier_product_id
      const { data: links, error: linksError } = await supabase
        .from('product_links')
        .select('supplier_product_id')
        .eq('analysis_id', analysisId);

      if (linksError) throw linksError;

      if (!links || links.length === 0) {
        setPrices([]);
        setBestPrice(null);
        setIsLoading(false);
        return;
      }

      const supplierProductIds = links.map(l => l.supplier_product_id);

      // Get supplier products with prices
      const { data: products, error: productsError } = await supabase
        .from('supplier_products')
        .select(`
          id,
          supplier_reference,
          purchase_price,
          stock_quantity,
          updated_at,
          supplier_configurations(supplier_name)
        `)
        .in('id', supplierProductIds)
        .order('purchase_price', { ascending: true, nullsFirst: false });

      if (productsError) throw productsError;

      if (products && products.length > 0) {
        const formattedPrices = products.map((item: any) => ({
          id: item.id,
          supplier_name: item.supplier_configurations?.supplier_name || 'Fournisseur inconnu',
          supplier_reference: item.supplier_reference,
          purchase_price: item.purchase_price || 0,
          currency: 'EUR',
          stock_quantity: item.stock_quantity ?? 0,
          last_updated: item.updated_at,
          is_price_missing: !item.purchase_price || item.purchase_price === 0,
        }));
        setPrices(formattedPrices);
        // Le meilleur prix est le premier avec un prix > 0, sinon le premier de la liste
        setBestPrice(formattedPrices.find(p => p.purchase_price > 0) || formattedPrices[0]);
      } else {
        setPrices([]);
        setBestPrice(null);
      }
    } catch (error) {
      console.error('Error fetching supplier prices:', error);
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
          console.log('Product change detected:', payload);
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

  return { prices, bestPrice, recentChanges, isLoading, refetch: fetchPrices };
};

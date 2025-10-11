import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SupplierPrice {
  id: string;
  supplier_name: string;
  purchase_price: number;
  currency: string;
  stock_quantity: number | null;
  last_updated: string;
  price_change_percentage?: number;
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
      const { data, error } = await supabase
        .from('supplier_price_variants')
        .select(`
          id,
          purchase_price,
          currency,
          stock_quantity,
          last_updated,
          supplier_configurations(supplier_name)
        `)
        .eq('analysis_id', analysisId)
        .order('purchase_price', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const formattedPrices = data.map((item: any) => ({
          id: item.id,
          supplier_name: item.supplier_configurations?.supplier_name || 'Fournisseur inconnu',
          purchase_price: item.purchase_price,
          currency: item.currency,
          stock_quantity: item.stock_quantity,
          last_updated: item.last_updated,
        }));
        setPrices(formattedPrices);
        setBestPrice(formattedPrices[0]);
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
          table: 'supplier_price_variants',
          filter: `analysis_id=eq.${analysisId}`,
        },
        (payload) => {
          console.log('Price change detected:', payload);

          // Détecter les changements de prix significatifs
          if (payload.eventType === 'UPDATE' && payload.old && payload.new) {
            const oldPrice = (payload.old as any).purchase_price;
            const newPrice = (payload.new as any).purchase_price;
            
            if (oldPrice && newPrice && oldPrice !== newPrice) {
              const changePercentage = ((newPrice - oldPrice) / oldPrice) * 100;
              
              if (Math.abs(changePercentage) > 5) {
                toast.info('🔔 Prix fournisseur mis à jour', {
                  description: `${(payload.new as any).supplier_name}: ${newPrice}€ (${changePercentage > 0 ? '+' : ''}${changePercentage.toFixed(1)}%)`,
                });

              setRecentChanges((prev) => [
                {
                  supplier_name: 'Fournisseur', // Will be updated on refetch
                  old_price: oldPrice,
                  new_price: newPrice,
                  change_percentage: changePercentage,
                },
                ...prev.slice(0, 4),
              ]);
              }
            }
          }

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

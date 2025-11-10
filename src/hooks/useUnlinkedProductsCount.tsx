import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUnlinkedProductsCount = () => {
  return useQuery({
    queryKey: ["unlinked-products-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      try {
        // Stratégie simplifiée: requête directe sans typage complexe
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/count_unlinked_products`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          }
        );

        if (!response.ok) {
          // Fallback: calcul manuel sans typage strict
          const linkedResult = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/product_links?select=supplier_product_id&user_id=eq.${user.id}`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              },
            }
          );
          const linkedData = await linkedResult.json();
          
          // ✅ Vérifier que linkedData est bien un tableau avant d'utiliser .map()
          if (!Array.isArray(linkedData)) {
            console.warn('[useUnlinkedProductsCount] linkedData is not an array:', linkedData);
            return 0;
          }
          
          const linkedIds = new Set(linkedData.map((p: any) => p.supplier_product_id));

          const totalResult = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/supplier_products?select=id&user_id=eq.${user.id}`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              },
            }
          );
          const totalData = await totalResult.json();
          const totalCount = (totalData || []).length;
          
          const unlinkedCount = totalCount - linkedIds.size;
          return unlinkedCount > 0 ? unlinkedCount : 0;
        }

        const count = await response.json();
        return count > 0 ? count : 0;
      } catch (error) {
        console.error("Error counting unlinked products:", error);
        return 0;
      }
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
};

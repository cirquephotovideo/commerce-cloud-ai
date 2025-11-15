import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { ImportedProductsList } from "@/components/code2asin/ImportedProductsList";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Code2AsinProductsList() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { data: totalCount } = useQuery({
    queryKey: ['code2asin-total-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('code2asin_enrichments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id
  });

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-3xl">
            <Package className="h-8 w-8" />
            Produits Code2ASIN
          </CardTitle>
          <CardDescription>
            Tous vos produits enrichis via code2asin.com avec les 52 champs détaillés
            {totalCount !== undefined && (
              <span className="ml-2 font-semibold text-foreground">
                ({totalCount} produit{totalCount > 1 ? 's' : ''} disponible{totalCount > 1 ? 's' : ''})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {user ? (
            <ImportedProductsList userId={user.id} />
          ) : (
            <p className="text-center text-muted-foreground py-8">Chargement...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
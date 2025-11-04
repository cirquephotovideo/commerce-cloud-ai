import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const CategoryAttributesHealth = () => {
  const { data: healthData } = useQuery({
    queryKey: ['category-attributes-health'],
    queryFn: async () => {
      const { data: categories } = await supabase
        .from('product_categories')
        .select('attribute_category, display_name');
      
      const categoriesWithCounts = await Promise.all(
        (categories || []).map(async (cat) => {
          const { count } = await supabase
            .from('product_attribute_definitions')
            .select('*', { count: 'exact', head: true })
            .eq('category', cat.attribute_category);
          
          return { ...cat, count: count || 0 };
        })
      );
      
      return categoriesWithCounts;
    },
    refetchInterval: 30000
  });

  const categoriesWithoutAttrs = healthData?.filter(c => c.count === 0) || [];
  const categoriesWithAttrs = healthData?.filter(c => c.count > 0) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>🏭 Santé des Catégories Odoo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categoriesWithAttrs.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Catégories configurées
            </h3>
            <div className="flex flex-wrap gap-2">
              {categoriesWithAttrs.map(cat => (
                <Badge key={cat.attribute_category} variant="default">
                  {cat.display_name} ({cat.count} attributs)
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {categoriesWithoutAttrs.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              ⚠️ Catégories sans attributs
            </h3>
            <div className="flex flex-wrap gap-2">
              {categoriesWithoutAttrs.map(cat => (
                <Badge key={cat.attribute_category} variant="destructive">
                  {cat.display_name} (0 attributs)
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              💡 Ces catégories utiliseront les attributs génériques par défaut.
              Importez des définitions spécifiques pour améliorer la qualité.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

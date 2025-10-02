import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package } from "lucide-react";

interface TaxonomyBadgesProps {
  analysisId: string;
}

export const TaxonomyBadges = ({ analysisId }: TaxonomyBadgesProps) => {
  const [mappings, setMappings] = useState<any[]>([]);

  useEffect(() => {
    const loadMappings = async () => {
      const { data, error } = await supabase
        .from('product_taxonomy_mappings')
        .select('*')
        .eq('analysis_id', analysisId);
      
      if (!error && data) {
        setMappings(data);
      }
    };

    loadMappings();
  }, [analysisId]);

  if (mappings.length === 0) return null;

  const googleMapping = mappings.find(m => m.taxonomy_type === 'google');
  const amazonMapping = mappings.find(m => m.taxonomy_type === 'amazon');

  return (
    <div className="flex gap-2 flex-wrap">
      {googleMapping && (
        <Badge variant="outline" className="text-xs flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" />
          <span className="font-mono text-muted-foreground">[{googleMapping.category_id}]</span>
          <span>{googleMapping.category_path}</span>
        </Badge>
      )}
      {amazonMapping && (
        <Badge variant="secondary" className="text-xs flex items-center gap-1">
          <Package className="w-3 h-3" />
          <span className="font-mono text-muted-foreground">[{amazonMapping.category_id}]</span>
          <span>{amazonMapping.category_path}</span>
        </Badge>
      )}
    </div>
  );
};

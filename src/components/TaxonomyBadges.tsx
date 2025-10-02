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

  const getShortPath = (path: string) => {
    const parts = path.split('>').map(p => p.trim());
    return parts[parts.length - 1] || path;
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {googleMapping && (
        <Badge variant="outline" className="text-xs">
          <ShoppingCart className="w-3 h-3 mr-1" />
          {getShortPath(googleMapping.category_path)}
        </Badge>
      )}
      {amazonMapping && (
        <Badge variant="secondary" className="text-xs">
          <Package className="w-3 h-3 mr-1" />
          {getShortPath(amazonMapping.category_path)}
        </Badge>
      )}
    </div>
  );
};

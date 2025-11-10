import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2 } from "lucide-react";

interface ProductLinksCellProps {
  analysisId: string;
}

export const ProductLinksCell = ({ analysisId }: ProductLinksCellProps) => {
  const { data: links, isLoading } = useQuery({
    queryKey: ["product-links", analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_links")
        .select(`
          id,
          link_type,
          confidence_score,
          supplier_product_id,
          supplier_products (
            product_name,
            supplier_configurations (
              supplier_name
            )
          )
        `)
        .eq("analysis_id", analysisId);

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <Skeleton className="h-6 w-20" />;
  }

  if (!links || links.length === 0) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Link2 className="h-3 w-3" />0 lien
      </Badge>
    );
  }

  const autoLinks = links.filter((l) => l.link_type === "auto").length;
  const manualLinks = links.filter((l) => l.link_type === "manual").length;
  const suggestedLinks = links.filter((l) => l.link_type === "suggested").length;

  return (
    <div className="flex gap-1 flex-wrap">
      {autoLinks > 0 && (
        <Badge variant="default" className="gap-1">
          <Link2 className="h-3 w-3" />
          {autoLinks} auto
        </Badge>
      )}
      {manualLinks > 0 && (
        <Badge variant="secondary" className="gap-1">
          <Link2 className="h-3 w-3" />
          {manualLinks} manuel
        </Badge>
      )}
      {suggestedLinks > 0 && (
        <Badge variant="outline" className="gap-1">
          <Link2 className="h-3 w-3" />
          {suggestedLinks} suggestion
        </Badge>
      )}
    </div>
  );
};

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Loader2, Link2 } from "lucide-react";
import { useAmazonProductLinks } from "@/hooks/useAmazonProductLinks";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AmazonAutoLinkPanel() {
  const { startAutoLink } = useAmazonProductLinks();
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({
    total_analyses: 0,
    total_enrichments: 0,
    linked_count: 0,
    potential_matches: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Count analyses with EAN
      const { count: analysesCount } = await supabase
        .from('product_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('ean', 'is', null);

      // Count enrichments
      const { count: enrichmentsCount } = await supabase
        .from('code2asin_enrichments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Count existing links
      const { count: linksCount } = await supabase
        .from('product_amazon_links')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats({
        total_analyses: analysesCount || 0,
        total_enrichments: enrichmentsCount || 0,
        linked_count: linksCount || 0,
        potential_matches: Math.min(analysesCount || 0, enrichmentsCount || 0) - (linksCount || 0)
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleAutoLink = async () => {
    setIsProcessing(true);
    try {
      await startAutoLink();
      // Reload stats after a delay
      setTimeout(() => {
        loadStats();
        setIsProcessing(false);
      }, 3000);
    } catch (error) {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-orange-500" />
          Fusion Automatique Amazon
        </CardTitle>
        <CardDescription>
          Liez automatiquement vos produits analysés avec les données Amazon (Code2ASIN)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Produits Analysés</p>
            <p className="text-2xl font-bold">{stats.total_analyses}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Enrichissements Amazon</p>
            <p className="text-2xl font-bold">{stats.total_enrichments}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-muted-foreground">Déjà Liés</p>
            <p className="text-2xl font-bold text-green-600">{stats.linked_count}</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-muted-foreground">À Lier</p>
            <p className="text-2xl font-bold text-orange-600">{stats.potential_matches}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
          <div className="flex-1">
            <h4 className="font-semibold text-orange-900 mb-1">
              Lien automatique par EAN
            </h4>
            <p className="text-sm text-orange-700">
              Le système va matcher automatiquement les produits ayant le même code EAN
            </p>
            {stats.potential_matches > 0 && (
              <Badge variant="secondary" className="mt-2">
                <Link2 className="h-3 w-3 mr-1" />
                {stats.potential_matches} correspondance{stats.potential_matches > 1 ? 's' : ''} potentielle{stats.potential_matches > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <Button
            onClick={handleAutoLink}
            disabled={isProcessing || stats.potential_matches === 0}
            className="ml-4"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fusion en cours...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Lancer la Fusion
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

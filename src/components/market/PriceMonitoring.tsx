import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, TrendingDown, TrendingUp } from "lucide-react";

export const PriceMonitoring = () => {
  const [productName, setProductName] = useState("");
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [monitoring, setMonitoring] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadSites();
    loadMonitoring();
  }, []);

  const loadSites = async () => {
    const { data } = await supabase
      .from('competitor_sites')
      .select('*')
      .eq('is_active', true);
    
    setSites(data || []);
    setSelectedSites(data?.map(s => s.id) || []);
  };

  const loadMonitoring = async () => {
    const { data } = await supabase
      .from('price_monitoring')
      .select('*, competitor_sites(site_name)')
      .order('scraped_at', { ascending: false })
      .limit(50);
    
    setMonitoring(data || []);
  };

  const handleSearch = async () => {
    if (!productName.trim()) {
      toast.error("Entrez un nom de produit");
      return;
    }

    if (selectedSites.length === 0) {
      toast.error("Sélectionnez au moins un site concurrent");
      return;
    }

    setIsSearching(true);
    
    const { data, error } = await supabase.functions.invoke('market-intelligence', {
      body: {
        action: 'search',
        productName,
        competitorSiteIds: selectedSites,
      }
    });

    setIsSearching(false);

    if (error) {
      toast.error("Erreur de recherche");
      return;
    }

    toast.success(data.message || "Recherche terminée");
    loadMonitoring();
  };

  const getPriceChange = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rechercher un Produit</CardTitle>
          <CardDescription>
            Comparez les prix en temps réel sur vos sites concurrents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nom du Produit</Label>
            <Input
              placeholder="Ex: iPhone 15 Pro 256GB"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          <div>
            <Label>Sites à surveiller ({selectedSites.length} sélectionnés)</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {sites.map((site) => (
                <label key={site.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={selectedSites.includes(site.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSites([...selectedSites, site.id]);
                      } else {
                        setSelectedSites(selectedSites.filter(id => id !== site.id));
                      }
                    }}
                  />
                  <span className="text-sm">{site.site_name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleSearch} disabled={isSearching} className="w-full">
            <Search className="w-4 h-4 mr-2" />
            {isSearching ? "Recherche en cours..." : "Rechercher les Prix"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique de Surveillance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monitoring.map((item) => {
              const change = getPriceChange(item.current_price, item.previous_price);
              return (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{item.product_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.competitor_sites?.site_name || 'Site inconnu'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(item.scraped_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{item.current_price}€</div>
                    {change !== null && (
                      <div className={`text-sm flex items-center justify-end ${change > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {Math.abs(change).toFixed(1)}%
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Stock: {item.stock_status}
                    </div>
                  </div>
                </div>
              );
            })}
            {monitoring.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Aucune donnée de surveillance
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
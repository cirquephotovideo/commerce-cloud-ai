import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";

export const CompetitorSitesManager = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [newSite, setNewSite] = useState({ name: "", url: "", type: "custom", frequency: "daily" });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    const { data, error } = await supabase
      .from('competitor_sites')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Erreur de chargement des sites");
      return;
    }

    setSites(data || []);
  };

  const handleAddSite = async () => {
    if (!newSite.name || !newSite.url) {
      toast.error("Nom et URL requis");
      return;
    }

    setIsAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('competitor_sites')
      .insert({
        user_id: user?.id,
        site_name: newSite.name,
        site_url: newSite.url,
        site_type: newSite.type,
        scraping_frequency: newSite.frequency,
      });

    setIsAdding(false);

    if (error) {
      toast.error("Erreur lors de l'ajout");
      return;
    }

    toast.success("Site concurrent ajouté");
    setNewSite({ name: "", url: "", type: "custom", frequency: "daily" });
    loadSites();
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('competitor_sites')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      toast.error("Erreur de mise à jour");
      return;
    }

    loadSites();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('competitor_sites')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error("Erreur de suppression");
      return;
    }

    toast.success("Site supprimé");
    loadSites();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un Site Concurrent</CardTitle>
          <CardDescription>
            Configurez les sites à surveiller automatiquement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nom du Site</Label>
              <Input
                placeholder="Amazon, Fnac, Darty..."
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                placeholder="https://www.example.com"
                value={newSite.url}
                onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={newSite.type} onValueChange={(v) => setNewSite({ ...newSite, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="fnac">Fnac</SelectItem>
                  <SelectItem value="darty">Darty</SelectItem>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fréquence</Label>
              <Select value={newSite.frequency} onValueChange={(v) => setNewSite({ ...newSite, frequency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Toutes les heures</SelectItem>
                  <SelectItem value="daily">Quotidien</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleAddSite} disabled={isAdding} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter le Site
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sites Configurés ({sites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sites.map((site) => (
              <div key={site.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{site.site_name}</div>
                  <div className="text-sm text-muted-foreground">{site.site_url}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Fréquence: {site.scraping_frequency}
                    {site.last_scraped_at && ` • Dernier scan: ${new Date(site.last_scraped_at).toLocaleString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={site.is_active}
                    onCheckedChange={() => handleToggleActive(site.id, site.is_active)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(site.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {sites.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Aucun site concurrent configuré
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
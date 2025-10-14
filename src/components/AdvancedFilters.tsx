import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Filter, Save, Trash2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface FilterConfig {
  minPrice?: number;
  maxPrice?: number;
  minMargin?: number;
  categories?: string[];
  suppliers?: string[];
  tags?: string[];
}

export const AdvancedFilters = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterName, setFilterName] = useState("");
  const [filterDescription, setFilterDescription] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minMargin, setMinMargin] = useState("");

  const { data: savedFilters, isLoading } = useQuery({
    queryKey: ["saved-filters"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("saved_filters")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const saveFilter = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!filterName.trim()) {
        throw new Error("Veuillez donner un nom au filtre");
      }

      const filterConfig: FilterConfig = {};
      if (minPrice) filterConfig.minPrice = parseFloat(minPrice);
      if (maxPrice) filterConfig.maxPrice = parseFloat(maxPrice);
      if (minMargin) filterConfig.minMargin = parseFloat(minMargin);

      const { error } = await supabase.from("saved_filters").insert([{
        user_id: user.id,
        name: filterName,
        description: filterDescription,
        filter_config: filterConfig as any,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast({ title: "Filtre sauvegardé avec succès" });
      setFilterName("");
      setFilterDescription("");
      setMinPrice("");
      setMaxPrice("");
      setMinMargin("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFilter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("saved_filters")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast({ title: "Filtre supprimé" });
    },
  });

  const setAsDefault = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Reset all defaults
      await supabase
        .from("saved_filters")
        .update({ is_default: false })
        .eq("user_id", user.id);

      // Set new default
      const { error } = await supabase
        .from("saved_filters")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters"] });
      toast({ title: "Filtre par défaut défini" });
    },
  });

  const loadFilter = (filter: any) => {
    const config = filter.filter_config as FilterConfig;
    setMinPrice(config.minPrice?.toString() || "");
    setMaxPrice(config.maxPrice?.toString() || "");
    setMinMargin(config.minMargin?.toString() || "");
    toast({ title: `Filtre "${filter.name}" chargé` });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres Avancés
          </CardTitle>
          <CardDescription>
            Créez et sauvegardez des filtres personnalisés pour vos recherches
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="min-price">Prix minimum (€)</Label>
              <Input
                id="min-price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="max-price">Prix maximum (€)</Label>
              <Input
                id="max-price"
                type="number"
                step="0.01"
                placeholder="1000.00"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="min-margin">Marge minimum (%)</Label>
              <Input
                id="min-margin"
                type="number"
                step="1"
                placeholder="20"
                value={minMargin}
                onChange={(e) => setMinMargin(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-name">Nom du filtre</Label>
            <Input
              id="filter-name"
              placeholder="Ex: Produits haute marge"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-description">Description (optionnel)</Label>
            <Textarea
              id="filter-description"
              placeholder="Description de ce filtre..."
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={() => saveFilter.mutate()}
            disabled={!filterName.trim() || saveFilter.isPending}
            className="w-full"
          >
            {saveFilter.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Sauvegarder le filtre
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtres Sauvegardés</CardTitle>
          <CardDescription>
            Cliquez sur un filtre pour le charger
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {savedFilters?.map((filter) => (
              <div
                key={filter.id}
                className="p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                onClick={() => loadFilter(filter)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{filter.name}</h4>
                      {filter.is_default && (
                        <Badge variant="default">
                          <Star className="h-3 w-3 mr-1" />
                          Par défaut
                        </Badge>
                      )}
                    </div>
                    {filter.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {filter.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(filter.filter_config as any)?.minPrice && (
                        <Badge variant="secondary">
                          Min: {(filter.filter_config as any).minPrice}€
                        </Badge>
                      )}
                      {(filter.filter_config as any)?.maxPrice && (
                        <Badge variant="secondary">
                          Max: {(filter.filter_config as any).maxPrice}€
                        </Badge>
                      )}
                      {(filter.filter_config as any)?.minMargin && (
                        <Badge variant="secondary">
                          Marge: {(filter.filter_config as any).minMargin}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!filter.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAsDefault.mutate(filter.id);
                        }}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFilter.mutate(filter.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {!savedFilters?.length && (
              <p className="text-center text-muted-foreground py-8">
                Aucun filtre sauvegardé. Créez-en un ci-dessus.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

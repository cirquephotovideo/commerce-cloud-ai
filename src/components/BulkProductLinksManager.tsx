import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Download, Filter } from "lucide-react";

export function BulkProductLinksManager() {
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterLinkType, setFilterLinkType] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: links, isLoading } = useQuery({
    queryKey: ["product-links-bulk", filterSupplier, filterLinkType],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("product_links")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("supplier_configurations")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as any[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (linkIds: string[]) => {
      const { error } = await supabase.from("product_links").delete().in("id", linkIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-links-bulk"] });
      setSelectedLinks(new Set());
      toast({ title: `${selectedLinks.size} lien(s) supprimé(s)` });
    },
  });

  const handleSelectAll = () => {
    setSelectedLinks(selectedLinks.size === links?.length ? new Set() : new Set(links?.map(l => l.id)));
  };

  const handleBulkDelete = () => {
    if (selectedLinks.size > 0 && confirm(`Supprimer ${selectedLinks.size} lien(s) ?`)) {
      deleteMutation.mutate(Array.from(selectedLinks));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestion en masse des liens</CardTitle>
        <CardDescription>Sélectionnez et gérez plusieurs liens simultanément</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Filter className="h-4 w-4 mt-2" />
          <Select value={filterLinkType} onValueChange={setFilterLinkType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="ean">EAN</SelectItem>
              <SelectItem value="manual">Manuel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedLinks.size > 0 && (
          <div className="flex gap-2 p-4 bg-muted rounded-lg">
            <span className="font-medium">{selectedLinks.size} sélectionné(s)</span>
            <div className="flex-1" />
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />Supprimer
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox checked={selectedLinks.size === links?.length} onCheckedChange={handleSelectAll} />
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Confiance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links?.map(link => (
              <TableRow key={link.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedLinks.has(link.id)}
                    onCheckedChange={() => {
                      const newSet = new Set(selectedLinks);
                      newSet.has(link.id) ? newSet.delete(link.id) : newSet.add(link.id);
                      setSelectedLinks(newSet);
                    }}
                  />
                </TableCell>
                <TableCell><Badge variant="outline">{link.link_type}</Badge></TableCell>
                <TableCell>{link.confidence_score ? `${(link.confidence_score * 100).toFixed(0)}%` : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

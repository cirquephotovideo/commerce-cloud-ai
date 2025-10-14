import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Trash2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export const BulkOperations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [operationType, setOperationType] = useState<string>("update_price");
  const [priceAdjustment, setPriceAdjustment] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"percentage" | "fixed">("percentage");

  const { data: products } = useQuery({
    queryKey: ["products-bulk"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("product_analyses")
        .select("id, analysis_result")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const { data: operations, isLoading: operationsLoading } = useQuery({
    queryKey: ["bulk-operations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("bulk_operations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const createBulkOperation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (selectedIds.length === 0) {
        throw new Error("Veuillez sélectionner au moins un produit");
      }

      let changes: any = {};
      
      if (operationType === "update_price") {
        changes = {
          type: "price_update",
          adjustment_type: adjustmentType,
          adjustment_value: parseFloat(priceAdjustment),
        };
      } else if (operationType === "delete") {
        changes = { type: "delete" };
      }

      const { data, error } = await supabase
        .from("bulk_operations")
        .insert({
          user_id: user.id,
          operation_type: operationType,
          target_ids: selectedIds,
          changes,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Process the operation
      await processBulkOperation(data.id, operationType, selectedIds, changes);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulk-operations"] });
      queryClient.invalidateQueries({ queryKey: ["products-bulk"] });
      toast({ title: "Opération en masse créée avec succès" });
      setSelectedIds([]);
      setPriceAdjustment("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processBulkOperation = async (
    operationId: string,
    type: string,
    ids: string[],
    changes: any
  ) => {
    let processed = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        if (type === "update_price") {
          // Update price logic
          const { data: product } = await supabase
            .from("product_analyses")
            .select("analysis_result")
            .eq("id", id)
            .single();

          if (product) {
            const currentPrice = (product.analysis_result as any)?.price || 0;
            let newPrice = currentPrice;

            if (changes.adjustment_type === "percentage") {
              newPrice = currentPrice * (1 + changes.adjustment_value / 100);
            } else {
              newPrice = currentPrice + changes.adjustment_value;
            }

            await supabase
              .from("product_analyses")
              .update({
                analysis_result: {
                  ...(product.analysis_result as any),
                  price: newPrice,
                } as any,
              })
              .eq("id", id);

            processed++;
          }
        } else if (type === "delete") {
          await supabase.from("product_analyses").delete().eq("id", id);
          processed++;
        }
      } catch (error) {
        failed++;
      }
    }

    // Update operation status
    await supabase
      .from("bulk_operations")
      .update({
        status: "completed",
        processed_count: processed,
        failed_count: failed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", operationId);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (products) {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Opérations en Masse
          </CardTitle>
          <CardDescription>
            Modifiez plusieurs produits en une seule fois
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={selectAll} variant="outline" size="sm">
              Tout sélectionner
            </Button>
            <Button onClick={deselectAll} variant="outline" size="sm">
              Tout désélectionner
            </Button>
            <Badge variant="secondary" className="ml-auto">
              {selectedIds.length} sélectionné(s)
            </Badge>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="operation-type">Type d'opération</Label>
              <Select value={operationType} onValueChange={setOperationType}>
                <SelectTrigger id="operation-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update_price">Ajuster les prix</SelectItem>
                  <SelectItem value="delete">Supprimer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {operationType === "update_price" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="adjustment-type">Type d'ajustement</Label>
                  <Select
                    value={adjustmentType}
                    onValueChange={(v: any) => setAdjustmentType(v)}
                  >
                    <SelectTrigger id="adjustment-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                      <SelectItem value="fixed">Montant fixe (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="price-adjustment">
                    Ajustement {adjustmentType === "percentage" ? "(%)" : "(€)"}
                  </Label>
                  <Input
                    id="price-adjustment"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 10"
                    value={priceAdjustment}
                    onChange={(e) => setPriceAdjustment(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    {adjustmentType === "percentage"
                      ? "Augmentez de 10% ou réduisez de -10%"
                      : "Ajoutez 5€ ou retirez -5€"}
                  </p>
                </div>
              </>
            )}

            <Button
              onClick={() => createBulkOperation.mutate()}
              disabled={
                selectedIds.length === 0 ||
                createBulkOperation.isPending ||
                (operationType === "update_price" && !priceAdjustment)
              }
              className="w-full"
            >
              {createBulkOperation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Edit className="h-4 w-4 mr-2" />
              )}
              Exécuter l'opération
            </Button>
          </div>

          <div className="border rounded-lg max-h-96 overflow-y-auto">
            <div className="space-y-2 p-4">
              {products?.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 border rounded hover:bg-accent cursor-pointer"
                  onClick={() => toggleSelection(product.id)}
                >
                  <Checkbox
                    checked={selectedIds.includes(product.id)}
                    onCheckedChange={() => toggleSelection(product.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">
                      {(product.analysis_result as any)?.name || "Produit sans nom"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Prix: {(product.analysis_result as any)?.price || "N/A"}€
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des opérations</CardTitle>
        </CardHeader>
        <CardContent>
          {operationsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {operations?.map((op) => (
                <div key={op.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge
                      variant={
                        op.status === "completed"
                          ? "default"
                          : op.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {op.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(op.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <p className="font-medium mb-1">
                    {op.operation_type === "update_price"
                      ? "Ajustement de prix"
                      : "Suppression"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {op.processed_count} traité(s) / {op.failed_count} échoué(s) sur{" "}
                    {op.target_ids.length} produit(s)
                  </p>
                </div>
              ))}

              {!operations?.length && (
                <p className="text-center text-muted-foreground py-8">
                  Aucune opération effectuée
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

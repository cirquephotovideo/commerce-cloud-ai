import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SupplierProductsTable() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products, isLoading } = useQuery({
    queryKey: ["supplier-products", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("supplier_products")
        .select("*, supplier_configurations(supplier_name), product_analyses(id)")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`ean.ilike.%${searchQuery}%,product_name.ilike.%${searchQuery}%,supplier_reference.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Produits Fournisseurs</span>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par EAN, nom ou référence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>EAN</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Prix d'achat</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : products?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Aucun produit trouvé
                </TableCell>
              </TableRow>
            ) : (
              products?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-sm">{product.ean || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">{product.product_name}</TableCell>
                  <TableCell>{product.supplier_reference || "-"}</TableCell>
                  <TableCell>
                    {product.purchase_price} {product.currency}
                  </TableCell>
                  <TableCell>{product.stock_quantity || "-"}</TableCell>
                  <TableCell>{product.supplier_configurations?.supplier_name}</TableCell>
                  <TableCell>
                    {product.product_analyses?.[0] ? (
                      <Badge className="bg-green-600 text-white">
                        <Link2 className="h-3 w-3 mr-1" />
                        Associé
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Non associé</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.supplier_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(product.supplier_url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

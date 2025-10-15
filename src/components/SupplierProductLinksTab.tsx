import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link2, Trash2, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { AutoLinkDialog } from "./AutoLinkDialog";

export function SupplierProductLinksTab() {
  const [showAutoLink, setShowAutoLink] = useState(false);
  const [userId, setUserId] = useState<string>('');

  // Get user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const { data: productLinks, refetch } = useQuery({
    queryKey: ['product-links'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('product_links')
        .select(`
          id,
          created_at,
          link_type,
          confidence_score,
          supplier_products (
            id,
            supplier_reference,
            product_name,
            ean,
            purchase_price,
            supplier_configurations (
              supplier_name
            )
          ),
          product_analyses (
            id,
            ean,
            analysis_result
          )
        `)
        .eq('created_by', user.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const handleDeleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('product_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      toast.success('Lien supprimé');
      refetch();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 90) return { variant: 'default', label: 'Élevée' };
    if (score >= 70) return { variant: 'secondary', label: 'Moyenne' };
    return { variant: 'outline', label: 'Faible' };
  };

  const getLinkTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ean: 'EAN',
      reference: 'Référence',
      name: 'Nom',
      manual: 'Manuel',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Produits liés ({productLinks?.length || 0})
              </CardTitle>
              <CardDescription>
                Gestion des liens entre produits fournisseurs et produits catalogue
              </CardDescription>
            </div>
            <Button onClick={() => setShowAutoLink(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Lier automatiquement
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Produit fournisseur</TableHead>
                <TableHead>Produit catalogue</TableHead>
                <TableHead>Type de lien</TableHead>
                <TableHead>Confiance</TableHead>
                <TableHead>Prix d'achat</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productLinks?.map((link) => {
                const supplierProduct = link.supplier_products as any;
                const analysis = link.product_analyses as any;
                const confidence = getConfidenceBadge(link.confidence_score || 0);

                return (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {supplierProduct?.supplier_configurations?.supplier_name || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {supplierProduct?.product_name || supplierProduct?.supplier_reference}
                        </div>
                        {supplierProduct?.ean && (
                          <div className="text-xs text-muted-foreground">
                            EAN: {supplierProduct.ean}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Réf: {supplierProduct?.supplier_reference}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {analysis?.analysis_result?.name || 'N/A'}
                        </div>
                        {analysis?.ean && (
                          <div className="text-xs text-muted-foreground">
                            EAN: {analysis.ean}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getLinkTypeLabel(link.link_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={confidence.variant as any}>
                        {confidence.label} ({link.confidence_score}%)
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {supplierProduct?.purchase_price?.toFixed(2) || '-'}€
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/imported-products?id=${analysis?.id}`, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLink(link.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {!productLinks?.length && (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">Aucun produit lié</p>
              <p className="text-sm">
                Les produits fournisseurs seront automatiquement liés lors des imports
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {showAutoLink && userId && (
        <AutoLinkDialog
          open={showAutoLink}
          onOpenChange={setShowAutoLink}
          userId={userId}
          onComplete={() => {
            setShowAutoLink(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

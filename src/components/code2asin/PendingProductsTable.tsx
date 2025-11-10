import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PendingProduct {
  id: string;
  ean: string;
  analysis_result: any;
  created_at: string;
  code2asin_enrichment_status: string;
  code2asin_enriched_at?: string;
}

interface PendingProductsTableProps {
  products: PendingProduct[];
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export function PendingProductsTable({
  products,
  isLoading,
  currentPage,
  onPageChange,
  totalItems,
  itemsPerPage
}: PendingProductsTableProps) {
  const navigate = useNavigate();
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Badge variant="secondary">Non démarré</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-500">En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Aucun produit en attente d'enrichissement</p>
        <p className="text-sm mt-2">Tous vos produits sont enrichis ! 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">EAN</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead className="w-[120px]">Exporté le</TableHead>
              <TableHead className="w-[120px]">Statut</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-mono text-xs">
                  {product.ean}
                </TableCell>
                <TableCell>
                  <div className="max-w-[300px] truncate">
                    {product.analysis_result?.product_name || 
                     product.analysis_result?.name || 
                     'Sans nom'}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(product.created_at), 'dd/MM/yyyy', { locale: fr })}
                </TableCell>
                <TableCell>
                  {getStatusBadge(product.code2asin_enrichment_status)}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/unified-products?search=${product.ean}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} sur {totalPages} ({totalItems} produits)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

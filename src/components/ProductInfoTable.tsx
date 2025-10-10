import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPrice, formatMargin, getMarginColor } from "@/lib/formatters";
import { AlertCircle } from "lucide-react";

interface ProductInfoTableProps {
  data: {
    productName?: string;
    ean?: string;
    purchasePrice?: number;
    sellingPrice?: number;
    margin?: number;
    supplier?: string;
    category?: string;
    ranking?: any;
    imageCount?: number;
    status?: string;
    brand?: string;
    stock?: number;
    description?: string;
  };
  columns?: ('name' | 'ean' | 'prices' | 'margin' | 'supplier' | 'category' | 'ranking' | 'images' | 'status' | 'brand' | 'stock' | 'description')[];
}

export function ProductInfoTable({ data, columns = ['name', 'ean', 'prices', 'margin', 'category'] }: ProductInfoTableProps) {
  const rows = [];

  if (columns.includes('name') && data.productName) {
    rows.push({ label: '📦 Nom du produit', value: data.productName });
  }
  
  if (columns.includes('brand') && data.brand) {
    rows.push({ label: '🏷️ Marque', value: data.brand });
  }

  if (columns.includes('description') && data.description) {
    const desc = data.description;
    const isTruncated = desc.endsWith('...') || desc.includes('jusqu&') || desc.length < 50;
    const displayDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
    
    rows.push({
      label: '📝 Description',
      value: (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-sm">{displayDesc}</span>
                {isTruncated && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Incomplète
                  </Badge>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <p>{desc}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    });
  }

  if (columns.includes('ean') && data.ean) {
    rows.push({ label: '🔢 EAN', value: data.ean });
  }

  if (columns.includes('prices')) {
    if (data.purchasePrice !== undefined) {
      rows.push({ label: '💰 Prix d\'achat', value: formatPrice(data.purchasePrice) });
    }
    if (data.sellingPrice !== undefined) {
      rows.push({ label: '💵 Prix de vente', value: formatPrice(data.sellingPrice) });
    }
  }

  if (columns.includes('margin') && data.margin !== undefined) {
    rows.push({ 
      label: '📈 Marge', 
      value: <Badge variant={getMarginColor(data.margin)}>{formatMargin(data.margin)}</Badge>
    });
  }

  if (columns.includes('supplier') && data.supplier) {
    rows.push({ label: '🏢 Fournisseur', value: data.supplier });
  }

  if (columns.includes('category') && data.category) {
    rows.push({ label: '📊 Catégorie', value: data.category });
  }

  if (columns.includes('stock') && data.stock !== undefined) {
    rows.push({ label: '📦 Stock', value: data.stock.toString() });
  }

  if (columns.includes('ranking') && data.ranking) {
    const rankingText = typeof data.ranking === 'object' && data.ranking.percentage 
      ? `Top ${data.ranking.percentage}%` 
      : String(data.ranking);
    rows.push({ label: '🌐 Ranking Amazon', value: rankingText });
  }

  if (columns.includes('images') && data.imageCount !== undefined) {
    rows.push({ label: '📷 Images', value: `${data.imageCount} photo${data.imageCount > 1 ? 's' : ''}` });
  }

  if (columns.includes('status') && data.status) {
    rows.push({ label: '✅ Statut', value: data.status });
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[180px]">Attribut</TableHead>
          <TableHead>Valeur</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index}>
            <TableCell className="font-medium text-muted-foreground">{row.label}</TableCell>
            <TableCell>{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

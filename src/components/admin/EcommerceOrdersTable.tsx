import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Package, RefreshCw, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

interface EcommerceOrder {
  id: string;
  order_number: string;
  platform: string;
  customer_name: string;
  customer_email: string;
  status: string;
  total_amount: number;
  currency: string;
  items_count: number;
  order_date: string;
  created_at: string;
}

export const EcommerceOrdersTable = () => {
  const [orders, setOrders] = useState<EcommerceOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<EcommerceOrder[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const platforms = ['all', 'shopify', 'woocommerce', 'prestashop', 'magento', 'odoo'];

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (selectedPlatform === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(o => o.platform === selectedPlatform));
    }
  }, [selectedPlatform, orders]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select('*')
        .order('order_date', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { variant: any; label: string } } = {
      pending: { variant: 'secondary', label: 'En attente' },
      processing: { variant: 'default', label: 'En cours' },
      completed: { variant: 'default', label: 'Complétée' },
      cancelled: { variant: 'destructive', label: 'Annulée' },
      refunded: { variant: 'destructive', label: 'Remboursée' }
    };
    const config = statusMap[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPlatformBadge = (platform: string) => {
    const colors: { [key: string]: string } = {
      shopify: 'bg-green-500',
      woocommerce: 'bg-purple-500',
      prestashop: 'bg-blue-500',
      magento: 'bg-orange-500',
      odoo: 'bg-red-500'
    };
    return (
      <Badge className={colors[platform] || 'bg-gray-500'}>
        {platform.charAt(0).toUpperCase() + platform.slice(1)}
      </Badge>
    );
  };

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Commandes E-commerce
            </CardTitle>
            <CardDescription>
              {filteredOrders.length} commande(s) • Revenu total: {totalRevenue.toFixed(2)}€
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par plateforme" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map(platform => (
                  <SelectItem key={platform} value={platform}>
                    {platform === 'all' ? 'Toutes les plateformes' : platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={fetchOrders} disabled={isLoading} size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune commande trouvée</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Commande</TableHead>
                <TableHead>Plateforme</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{getPlatformBadge(order.platform)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>{order.items_count}</TableCell>
                  <TableCell className="font-medium">
                    {order.total_amount.toFixed(2)} {order.currency}
                  </TableCell>
                  <TableCell>
                    {format(new Date(order.order_date), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

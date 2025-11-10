import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2 } from "lucide-react";

export const UserAlerts = () => {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    const { data } = await supabase
      .from('user_alerts')
      .select('*')
      .order('created_at', { ascending: false });
    
    setAlerts(data || []);
  };

  const handleMarkAsRead = async (id: string) => {
    const { error } = await supabase
      .from('user_alerts')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      toast.error("Erreur de mise à jour");
      return;
    }

    loadAlerts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('user_alerts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error("Erreur de suppression");
      return;
    }

    toast.success("Alerte supprimée");
    loadAlerts();
  };

  const handleDeleteAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_alerts')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      return;
    }

    toast.success(`${alerts.length} alerte(s) supprimée(s)`);
    loadAlerts();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alertes ({unreadCount} non lues)
          </CardTitle>
          {alerts.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAll}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Effacer tous
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border rounded-lg ${!alert.is_read ? 'bg-accent/50' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={getPriorityColor(alert.priority) as any}>
                      {alert.priority}
                    </Badge>
                    <span className="text-sm font-medium">{alert.alert_type}</span>
                  </div>
                  
                  {/* Format alert message based on type */}
                  {alert.alert_type === 'supplier_price_change' && alert.alert_data ? (
                    <div className="space-y-1">
                      <div className="font-medium text-sm">
                        {alert.alert_data.product_name || alert.alert_data.supplier_reference}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Fournisseur: {alert.alert_data.supplier_name}
                      </div>
                      <div className="flex items-center gap-4 text-sm mt-2">
                        <span className="text-red-600">
                          Prix avant: {alert.alert_data.old_price?.toFixed(2)}€
                        </span>
                        <span className="text-green-600">
                          Prix actuel: {alert.alert_data.new_price?.toFixed(2)}€
                        </span>
                        <Badge variant={alert.alert_data.variation_pct > 0 ? "destructive" : "default"}>
                          {alert.alert_data.variation_pct > 0 ? '+' : ''}{alert.alert_data.variation_pct?.toFixed(1)}%
                        </Badge>
                      </div>
                      {alert.alert_data.ean && (
                        <div className="text-xs text-muted-foreground mt-1">
                          EAN: {alert.alert_data.ean}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {JSON.stringify(alert.alert_data, null, 2)}
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(alert.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!alert.is_read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMarkAsRead(alert.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(alert.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucune alerte
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
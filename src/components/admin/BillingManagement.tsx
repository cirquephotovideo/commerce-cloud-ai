import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DollarSign } from "lucide-react";

interface BillingRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created_at: string;
  paid_at: string | null;
  user_id: string;
}

export const BillingManagement = () => {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchBillingRecords();
  }, []);

  const fetchBillingRecords = async () => {
    try {
      const { data: billingData, error } = await supabase
        .from("billing_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch user emails separately
      if (billingData && billingData.length > 0) {
        const userIds = [...new Set(billingData.map(r => r.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.id, p]) || []
        );

        const enrichedData = billingData.map(record => ({
          ...record,
          userEmail: profilesMap.get(record.user_id)?.email || "N/A",
          userName: profilesMap.get(record.user_id)?.full_name || "-",
        }));

        setRecords(enrichedData as any);
      } else {
        setRecords([]);
      }
    } catch (error) {
      console.error("Error fetching billing records:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique de facturation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500">Payé</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">En attente</Badge>;
      case "failed":
        return <Badge variant="destructive">Échoué</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Historique de Facturation
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date création</TableHead>
                <TableHead>Date paiement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{(record as any).userEmail}</p>
                      <p className="text-sm text-muted-foreground">
                        {(record as any).userName}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{record.description}</TableCell>
                  <TableCell className="font-medium">
                    {record.amount} {record.currency}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell>
                    {new Date(record.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    {record.paid_at
                      ? new Date(record.paid_at).toLocaleDateString("fr-FR")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {records.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            Aucune transaction trouvée
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportMetricsDashboard } from "@/components/admin/ImportMetricsDashboard";
import { DeadLetterQueueManager } from "@/components/admin/DeadLetterQueueManager";
import { Shield, Activity, AlertTriangle } from "lucide-react";

export default function Admin() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">System Administration</h1>
          <p className="text-muted-foreground">
            Monitor and manage import operations
          </p>
        </div>
      </div>

      <Tabs defaultValue="metrics" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="dlq" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            DLQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-6">
          <ImportMetricsDashboard />
        </TabsContent>

        <TabsContent value="dlq" className="space-y-6">
          <DeadLetterQueueManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

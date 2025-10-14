import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, CreditCard, LineChart, Settings, Server, ShoppingCart, Brain, Key, Shield, Mail, Bell } from "lucide-react";
import { UserManagement } from "@/components/admin/UserManagement";
import { PlanManagement } from "@/components/admin/PlanManagement";
import { BillingManagement } from "@/components/admin/BillingManagement";
import { Analytics } from "@/components/admin/Analytics";
import { APIKeyManagement } from "@/components/admin/APIKeyManagement";
import { SystemHealthCheck } from "@/components/admin/SystemHealthCheck";
import { SystemLogs } from "@/components/admin/SystemLogs";
import { DatabaseHealthChecker } from "@/components/admin/DatabaseHealthChecker";
import { ImportErrorsManager } from "@/components/admin/ImportErrorsManager";
import { EmailMarketing } from "@/components/admin/marketing/EmailMarketing";
import { SocialMediaManager } from "@/components/admin/marketing/SocialMediaManager";
import { AmazonCredentialsManager } from "@/components/admin/AmazonCredentialsManager";
import AIProviderManagement from "@/components/AIProviderManagement";
import { FixHistoryDashboard } from "@/components/admin/FixHistoryDashboard";
import { FeatureIdeaGenerator } from "@/components/admin/FeatureIdeaGenerator";
import { EnrichmentProgressMonitor } from "@/components/EnrichmentProgressMonitor";
import { GlobalAPIKeysManager } from "@/components/admin/GlobalAPIKeysManager";
import { GlobalConfigManager } from "@/components/admin/GlobalConfigManager";
import { FeaturePermissions } from "@/components/admin/FeaturePermissions";
import { AIPromptsManagement } from "@/components/admin/AIPromptsManagement";
import { AmazonLogs } from "@/components/admin/AmazonLogs";
import { AmazonProductTester } from "@/components/admin/AmazonProductTester";
import { RoleDebugger } from "@/components/admin/RoleDebugger";
import { OllamaConfiguration } from "@/components/admin/OllamaConfiguration";
import { MCPServerConfiguration } from "@/components/admin/MCPServerConfiguration";
import { NewsletterManager } from "@/components/admin/marketing/NewsletterManager";
import { UserAlertsWidget } from "@/components/UserAlertsWidget";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("monitoring");
  useRealtimeAlerts();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground mt-2">
          Gérez les utilisateurs, les abonnements et les paramètres système
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <LineChart className="h-4 w-4" />
            <span>📊 Monitoring</span>
          </TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>🔐 Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>👥 Users & Billing</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <span>🛠️ Advanced</span>
          </TabsTrigger>
        </TabsList>

        {/* 📊 MONITORING */}
        <TabsContent value="monitoring" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Health & Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <SystemHealthCheck />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Import Errors Management</CardTitle>
              </CardHeader>
              <CardContent>
                <ImportErrorsManager />
              </CardContent>
            </Card>

            <EnrichmentProgressMonitor />

            <Card>
              <CardHeader>
                <CardTitle>Analytics & Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <Analytics />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <UserAlertsWidget />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 🔐 CONFIGURATION */}
        <TabsContent value="configuration" className="space-y-6">
          <Tabs defaultValue="amazon" className="space-y-6">
            <TabsList>
              <TabsTrigger value="amazon">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Amazon
              </TabsTrigger>
              <TabsTrigger value="ai">
                <Brain className="h-4 w-4 mr-2" />
                AI Providers
              </TabsTrigger>
              <TabsTrigger value="api">
                <Key className="h-4 w-4 mr-2" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="prompts">
                <Brain className="h-4 w-4 mr-2" />
                AI Prompts
              </TabsTrigger>
              <TabsTrigger value="permissions">
                <Shield className="h-4 w-4 mr-2" />
                Permissions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="amazon">
              <AmazonCredentialsManager />
            </TabsContent>

            <TabsContent value="ai">
              <AIProviderManagement />
            </TabsContent>

            <TabsContent value="api" className="space-y-6">
              <GlobalAPIKeysManager />
              <APIKeyManagement />
              <OllamaConfiguration />
              <MCPServerConfiguration />
            </TabsContent>

            <TabsContent value="prompts">
              <AIPromptsManagement />
            </TabsContent>

            <TabsContent value="permissions">
              <FeaturePermissions />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* 👥 USERS & BILLING */}
        <TabsContent value="users" className="space-y-6">
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList>
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                Users
              </TabsTrigger>
              <TabsTrigger value="plans">
                <Package className="h-4 w-4 mr-2" />
                Plans
              </TabsTrigger>
              <TabsTrigger value="billing">
                <CreditCard className="h-4 w-4 mr-2" />
                Billing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

            <TabsContent value="plans">
              <PlanManagement />
            </TabsContent>

            <TabsContent value="billing">
              <BillingManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* 🛠️ ADVANCED */}
        <TabsContent value="advanced" className="space-y-6">
          <Tabs defaultValue="database" className="space-y-6">
            <TabsList>
              <TabsTrigger value="database">
                <Server className="h-4 w-4 mr-2" />
                Database
              </TabsTrigger>
              <TabsTrigger value="logs">
                <Server className="h-4 w-4 mr-2" />
                System Logs
              </TabsTrigger>
              <TabsTrigger value="amazon-logs">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Amazon Logs
              </TabsTrigger>
              <TabsTrigger value="fixes">
                <Server className="h-4 w-4 mr-2" />
                Fix History
              </TabsTrigger>
              <TabsTrigger value="ideas">
                <Server className="h-4 w-4 mr-2" />
                Feature Ideas
              </TabsTrigger>
              <TabsTrigger value="marketing">
                <Mail className="h-4 w-4 mr-2" />
                Marketing
              </TabsTrigger>
              <TabsTrigger value="debug">
                <Settings className="h-4 w-4 mr-2" />
                Debug Tools
              </TabsTrigger>
            </TabsList>

            <TabsContent value="database">
              <DatabaseHealthChecker />
            </TabsContent>

            <TabsContent value="logs">
              <SystemLogs />
            </TabsContent>

            <TabsContent value="amazon-logs">
              <AmazonLogs />
            </TabsContent>

            <TabsContent value="fixes">
              <FixHistoryDashboard />
            </TabsContent>

            <TabsContent value="ideas">
              <FeatureIdeaGenerator />
            </TabsContent>

            <TabsContent value="marketing" className="space-y-6">
              <EmailMarketing />
              <SocialMediaManager />
              <NewsletterManager />
            </TabsContent>

            <TabsContent value="debug" className="space-y-6">
              <GlobalConfigManager />
              <AmazonProductTester />
              <RoleDebugger />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;

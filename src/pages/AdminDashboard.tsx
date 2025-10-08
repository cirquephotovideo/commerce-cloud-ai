import { useState } from "react";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/admin/UserManagement";
import { PlanManagement } from "@/components/admin/PlanManagement";
import { Analytics } from "@/components/admin/Analytics";
import { BillingManagement } from "@/components/admin/BillingManagement";
import { SystemLogs } from "@/components/admin/SystemLogs";
import { EmailMarketing } from "@/components/admin/marketing/EmailMarketing";
import { SocialMediaManager } from "@/components/admin/marketing/SocialMediaManager";
import { NewsletterManager } from "@/components/admin/marketing/NewsletterManager";
import { APIKeyManagement } from "@/components/admin/APIKeyManagement";
import { RoleDebugger } from "@/components/admin/RoleDebugger";
import { FeaturePermissions } from "@/components/admin/FeaturePermissions";
import { OllamaConfiguration } from "@/components/admin/OllamaConfiguration";
import { AmazonLogs } from "@/components/admin/AmazonLogs";
import { AIPromptsManagement } from "@/components/admin/AIPromptsManagement";
import { Shield, Users, Package, BarChart3, DollarSign, FileText, Mail, Share2, Bell, Key, Info, ShoppingCart, Zap } from "lucide-react";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("analytics");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Administration
            </h1>
          </div>
          <p className="text-muted-foreground">
            Tableau de bord super administrateur - Gestion complète de la plateforme
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-13 lg:w-auto">
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <Package className="h-4 w-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <FileText className="h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="amazon-logs" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Amazon
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-2">
              <Share2 className="h-4 w-4" />
              Réseaux
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="gap-2">
              <Bell className="h-4 w-4" />
              Newsletter
            </TabsTrigger>
            <TabsTrigger value="apikeys" className="gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="debug" className="gap-2">
              <Info className="h-4 w-4" />
              Debug
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="ai-prompts" className="gap-2">
              <Zap className="h-4 w-4" />
              Prompts IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <Analytics />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="plans" className="space-y-6">
            <PlanManagement />
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <BillingManagement />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <SystemLogs />
          </TabsContent>

          <TabsContent value="amazon-logs" className="space-y-6">
            <AmazonLogs />
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <EmailMarketing />
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <SocialMediaManager />
          </TabsContent>

          <TabsContent value="newsletter" className="space-y-6">
            <NewsletterManager />
          </TabsContent>

          <TabsContent value="apikeys" className="space-y-6">
            <APIKeyManagement />
          </TabsContent>

          <TabsContent value="debug" className="space-y-6">
            <RoleDebugger />
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <FeaturePermissions />
            <OllamaConfiguration />
          </TabsContent>

          <TabsContent value="ai-prompts" className="space-y-6">
            <AIPromptsManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;

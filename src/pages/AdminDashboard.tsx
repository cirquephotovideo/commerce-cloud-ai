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
import AIProviderManagement from "@/components/admin/AIProviderManagement";
import { Shield, Users, Package, BarChart3, DollarSign, FileText, Mail, Share2, Bell, Key, Info, ShoppingCart, Zap, Brain } from "lucide-react";

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
          <div className="bg-card rounded-lg border p-2">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 h-auto bg-transparent">
              <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Utilisateurs</span>
              </TabsTrigger>
              <TabsTrigger value="plans" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Plans</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Facturation</span>
              </TabsTrigger>
              <TabsTrigger value="ai-prompts" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Prompts IA</span>
              </TabsTrigger>
              <TabsTrigger value="ai-providers" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Providers IA</span>
              </TabsTrigger>
              <TabsTrigger value="apikeys" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Key className="h-4 w-4" />
                <span className="hidden sm:inline">API Keys</span>
              </TabsTrigger>
              <TabsTrigger value="permissions" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Permissions</span>
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email</span>
              </TabsTrigger>
              <TabsTrigger value="social" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Réseaux</span>
              </TabsTrigger>
              <TabsTrigger value="newsletter" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Newsletter</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Logs</span>
              </TabsTrigger>
              <TabsTrigger value="amazon-logs" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Amazon</span>
              </TabsTrigger>
              <TabsTrigger value="debug" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Info className="h-4 w-4" />
                <span className="hidden sm:inline">Debug</span>
              </TabsTrigger>
            </TabsList>
          </div>

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

          <TabsContent value="ai-providers" className="space-y-6">
            <AIProviderManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoEmailInbox } from "./demo/DemoEmailInbox";
import { DemoAutomationWizard } from "./demo/DemoAutomationWizard";
import { DemoAutomationDashboard } from "./demo/DemoAutomationDashboard";
import { DemoProductComparison } from "./demo/DemoProductComparison";
import { DemoMarketIntelligence } from "./demo/DemoMarketIntelligence";
import { DemoExportPlatforms } from "./demo/DemoExportPlatforms";

const Demo = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Démonstration Tarifique.com</h1>
          <p className="text-muted-foreground">Interfaces réelles de l'application</p>
        </div>

        <Tabs defaultValue="email-inbox" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-8">
            <TabsTrigger value="email-inbox">Email Inbox</TabsTrigger>
            <TabsTrigger value="automation-wizard">Wizard Auto</TabsTrigger>
            <TabsTrigger value="automation-dashboard">Dashboard Auto</TabsTrigger>
            <TabsTrigger value="products">Produits</TabsTrigger>
            <TabsTrigger value="market">Market Intel</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="email-inbox">
            <DemoEmailInbox />
          </TabsContent>

          <TabsContent value="automation-wizard">
            <DemoAutomationWizard />
          </TabsContent>

          <TabsContent value="automation-dashboard">
            <DemoAutomationDashboard />
          </TabsContent>

          <TabsContent value="products">
            <DemoProductComparison />
          </TabsContent>

          <TabsContent value="market">
            <DemoMarketIntelligence />
          </TabsContent>

          <TabsContent value="export">
            <DemoExportPlatforms />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Demo;

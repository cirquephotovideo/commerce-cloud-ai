import { useState } from "react";
import { CompetitorSitesManager } from "@/components/market/CompetitorSitesManager";
import { PriceMonitoring } from "@/components/market/PriceMonitoring";
import { MarketTrends } from "@/components/market/MarketTrends";
import { UserAlerts } from "@/components/market/UserAlerts";
import { GoogleShoppingAnalysis } from "@/components/market/GoogleShoppingAnalysis";
import { MarketComparison } from "@/components/market/MarketComparison";
import { MarketIntelligenceDashboard } from "@/components/market/MarketIntelligenceDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MarketIntelligence = () => {
  return (
    <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Intelligence Marché</h1>
          <p className="text-muted-foreground">
            Surveillez automatiquement vos concurrents et les tendances du marché
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dashboard">Dashboard IA</TabsTrigger>
            <TabsTrigger value="google-shopping">Google Shopping</TabsTrigger>
            <TabsTrigger value="monitoring">Surveillance Prix</TabsTrigger>
            <TabsTrigger value="comparison">Comparaison</TabsTrigger>
            <TabsTrigger value="competitors">Concurrents</TabsTrigger>
            <TabsTrigger value="trends">Tendances</TabsTrigger>
            <TabsTrigger value="alerts">Alertes</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <MarketIntelligenceDashboard />
          </TabsContent>

          <TabsContent value="google-shopping" className="space-y-6">
            <GoogleShoppingAnalysis />
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <PriceMonitoring />
          </TabsContent>

          <TabsContent value="comparison" className="space-y-6">
            <MarketComparison />
          </TabsContent>

          <TabsContent value="competitors" className="space-y-6">
            <CompetitorSitesManager />
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <MarketTrends />
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <UserAlerts />
          </TabsContent>
        </Tabs>
      </main>
  );
};

export default MarketIntelligence;
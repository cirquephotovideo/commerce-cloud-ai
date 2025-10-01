import { useState } from "react";
import { Header } from "@/components/Header";
import { CompetitorSitesManager } from "@/components/market/CompetitorSitesManager";
import { PriceMonitoring } from "@/components/market/PriceMonitoring";
import { MarketTrends } from "@/components/market/MarketTrends";
import { UserAlerts } from "@/components/market/UserAlerts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MarketIntelligence = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Intelligence Marché</h1>
          <p className="text-muted-foreground">
            Surveillez automatiquement vos concurrents et les tendances du marché
          </p>
        </div>

        <Tabs defaultValue="monitoring" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="monitoring">Surveillance Prix</TabsTrigger>
            <TabsTrigger value="competitors">Sites Concurrents</TabsTrigger>
            <TabsTrigger value="trends">Tendances</TabsTrigger>
            <TabsTrigger value="alerts">Alertes</TabsTrigger>
          </TabsList>

          <TabsContent value="monitoring" className="space-y-6">
            <PriceMonitoring />
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
    </div>
  );
};

export default MarketIntelligence;
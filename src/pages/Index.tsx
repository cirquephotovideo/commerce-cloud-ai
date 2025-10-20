import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { TrustBar } from "@/components/TrustBar";
import { StatsSection } from "@/components/StatsSection";
import { ProblemsToSolutions } from "@/components/ProblemsToSolutions";
import { FeaturesSection } from "@/components/FeaturesSection";
import { AutomationShowcase } from "@/components/AutomationShowcase";
import { EnrichmentBeforeAfter } from "@/components/EnrichmentBeforeAfter";
import { MarketIntelligenceShowcase } from "@/components/MarketIntelligenceShowcase";
import { PlatformExportShowcase } from "@/components/PlatformExportShowcase";
import { InteractiveDemo } from "@/components/InteractiveDemo";
import { StatsCharts } from "@/components/StatsCharts";
import { CaseStudies } from "@/components/CaseStudies";
import { PricingSection } from "@/components/PricingSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { ComparisonSection } from "@/components/ComparisonSection";
import { FAQSection } from "@/components/FAQSection";
import { TrustSignalsSection } from "@/components/TrustSignalsSection";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <TrustBar />
      <StatsSection />
      <ProblemsToSolutions />
      <FeaturesSection />
      <AutomationShowcase />
      <EnrichmentBeforeAfter />
      <MarketIntelligenceShowcase />
      <PlatformExportShowcase />
      <div id="demo">
        <InteractiveDemo />
      </div>
      <StatsCharts />
      <CaseStudies />
      <PricingSection />
      <TestimonialsSection />
      <ComparisonSection />
      <FAQSection />
      <TrustSignalsSection />
      <FinalCTA />
      <Footer />
    </main>
  );
};

export default Index;

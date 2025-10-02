import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { StatsSection } from "@/components/StatsSection";
import { InteractiveDemo } from "@/components/InteractiveDemo";
import { FeaturesSection } from "@/components/FeaturesSection";
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
      <StatsSection />
      <div id="demo">
        <InteractiveDemo />
      </div>
      <FeaturesSection />
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

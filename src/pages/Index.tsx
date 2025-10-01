import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { ChatSection } from "@/components/ChatSection";
import { AnalyzerSection } from "@/components/AnalyzerSection";
import { FeaturesSection } from "@/components/FeaturesSection";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <ChatSection />
      <AnalyzerSection />
      <FeaturesSection />
    </main>
  );
};

export default Index;

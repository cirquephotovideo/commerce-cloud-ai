import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { AuthPage } from "./components/AuthPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import BatchAnalyzer from "./pages/BatchAnalyzer";
import MarketIntelligence from "./pages/MarketIntelligence";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import SubscriptionWelcome from "./pages/SubscriptionWelcome";
import NotFound from "./pages/NotFound";
import { TrialStatus } from "./components/TrialStatus";
import { TrialExpiredModal } from "./components/TrialExpiredModal";
import { useSubscription } from "./contexts/SubscriptionContext";
import { useState, useEffect } from "react";

const App = () => {
  const { trialExpired } = useSubscription();
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);

  useEffect(() => {
    if (trialExpired) {
      setShowTrialExpiredModal(true);
    }
  }, [trialExpired]);

  return (
    <>
      <TrialStatus />
      <TrialExpiredModal 
        open={showTrialExpiredModal} 
        onOpenChange={setShowTrialExpiredModal} 
      />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/welcome" element={<ProtectedRoute><SubscriptionWelcome /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/batch-analyzer" element={<ProtectedRoute><BatchAnalyzer /></ProtectedRoute>} />
        <Route path="/market-intelligence" element={<ProtectedRoute><MarketIntelligence /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;

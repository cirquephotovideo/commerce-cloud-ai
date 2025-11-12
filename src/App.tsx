import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { AuthPage } from "./components/AuthPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import BatchAnalyzer from "./pages/BatchAnalyzer";
import MarketIntelligence from "./pages/MarketIntelligence";
import Suppliers from "./pages/Suppliers";
import ImportedProducts from "./pages/ImportedProducts";
import ImportExportDashboard from "./pages/ImportExportDashboard";
import Analytics from "./pages/Analytics";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSystemTests from "./pages/AdminSystemTests";
import AdminQuality from "./pages/AdminQuality";
import SystemObservability from "./pages/SystemObservability";
import SubscriptionWelcome from "./pages/SubscriptionWelcome";
import NotFound from "./pages/NotFound";
import Demo from "./pages/Demo";
import UniversalWizard from "./pages/UniversalWizard";
import ProductsManagement from "./pages/ProductsManagement";
import Code2AsinExport from "./pages/Code2AsinExport";
import Code2AsinImport from "./pages/Code2AsinImport";
import Code2AsinProductsList from "./pages/Code2AsinProductsList";
import Code2AsinTracker from "./pages/Code2AsinTracker";
import UnifiedProductsManagement from "./pages/UnifiedProductsManagement";
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
        <Route path="/demo" element={<Demo />} />
        <Route path="/wizard" element={<ProtectedRoute><DashboardLayout><UniversalWizard /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/welcome" element={<ProtectedRoute><DashboardLayout><SubscriptionWelcome /></DashboardLayout></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><DashboardLayout><History /></DashboardLayout></ProtectedRoute>} />
        <Route path="/batch-analyzer" element={<ProtectedRoute><DashboardLayout><BatchAnalyzer /></DashboardLayout></ProtectedRoute>} />
        <Route path="/market-intelligence" element={<ProtectedRoute><DashboardLayout><MarketIntelligence /></DashboardLayout></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute><DashboardLayout><Suppliers /></DashboardLayout></ProtectedRoute>} />
        <Route path="/imported-products" element={<ProtectedRoute><DashboardLayout><ImportedProducts /></DashboardLayout></ProtectedRoute>} />
        <Route path="/import-export-dashboard" element={<ProtectedRoute><DashboardLayout><ImportExportDashboard /></DashboardLayout></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><DashboardLayout><Analytics /></DashboardLayout></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><DashboardLayout><ProductsManagement /></DashboardLayout></ProtectedRoute>} />
        <Route path="/unified-products" element={<ProtectedRoute><DashboardLayout><UnifiedProductsManagement /></DashboardLayout></ProtectedRoute>} />
        <Route path="/code2asin-export" element={<ProtectedRoute><DashboardLayout><Code2AsinExport /></DashboardLayout></ProtectedRoute>} />
        <Route path="/code2asin-import" element={<ProtectedRoute><DashboardLayout><Code2AsinImport /></DashboardLayout></ProtectedRoute>} />
        <Route path="/code2asin-products" element={<ProtectedRoute><DashboardLayout><Code2AsinProductsList /></DashboardLayout></ProtectedRoute>} />
        <Route path="/code2asin-tracker" element={<ProtectedRoute><DashboardLayout><Code2AsinTracker /></DashboardLayout></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><DashboardLayout><AdminDashboard /></DashboardLayout></AdminRoute>} />
        <Route path="/admin/system-tests" element={<AdminRoute><DashboardLayout><AdminSystemTests /></DashboardLayout></AdminRoute>} />
        <Route path="/admin/quality" element={<AdminRoute><DashboardLayout><AdminQuality /></DashboardLayout></AdminRoute>} />
        <Route path="/observability" element={<AdminRoute><DashboardLayout><SystemObservability /></DashboardLayout></AdminRoute>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;

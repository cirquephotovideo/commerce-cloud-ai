import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface ProductTourContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  hasCompletedTour: boolean;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  closeTour: () => void;
}

const ProductTourContext = createContext<ProductTourContextType | undefined>(undefined);

const STORAGE_KEY = 'product-tour-storage';

interface StorageState {
  hasCompletedTour: boolean;
}

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const totalSteps = 7;

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: StorageState = JSON.parse(stored);
      setHasCompletedTour(data.hasCompletedTour);
    }
  }, []);

  // Save to localStorage
  const saveToStorage = (completed: boolean) => {
    const data: StorageState = { hasCompletedTour: completed };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const startTour = () => {
    setIsActive(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    setIsActive(false);
    setCurrentStep(0);
    setHasCompletedTour(true);
    saveToStorage(true);
  };

  const completeTour = () => {
    setIsActive(false);
    setCurrentStep(0);
    setHasCompletedTour(true);
    saveToStorage(true);
  };

  const closeTour = () => {
    setIsActive(false);
    setCurrentStep(0);
  };

  return (
    <ProductTourContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps,
        hasCompletedTour,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        closeTour,
      }}
    >
      {children}
    </ProductTourContext.Provider>
  );
}

export function useProductTour() {
  const context = useContext(ProductTourContext);
  if (!context) {
    throw new Error('useProductTour must be used within ProductTourProvider');
  }
  return context;
}

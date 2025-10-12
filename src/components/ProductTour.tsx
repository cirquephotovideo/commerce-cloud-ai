import { useEffect, useState, useCallback } from "react";
import { useProductTour } from "@/hooks/useProductTour";
import { tourSteps } from "@/lib/tourSteps";
import { TourStepComponent } from "./TourStep";

export function ProductTour() {
  const { 
    isActive, 
    currentStep, 
    totalSteps, 
    nextStep, 
    prevStep, 
    skipTour,
    closeTour 
  } = useProductTour();

  const [targetPosition, setTargetPosition] = useState<{ top: number; left: number } | null>(null);

  const step = tourSteps[currentStep];

  const updateTargetPosition = useCallback(() => {
    if (!step || !isActive) return;

    const element = document.querySelector(step.target);
    if (element && step.placement !== 'center') {
      const rect = element.getBoundingClientRect();
      setTargetPosition({
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width / 2,
      });
    } else {
      setTargetPosition(null);
    }
  }, [step, isActive]);

  useEffect(() => {
    if (!isActive) return;

    updateTargetPosition();
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition);
    };
  }, [isActive, updateTargetPosition]);

  useEffect(() => {
    if (!isActive || !step) return;

    const element = document.querySelector(step.target);
    if (element && step.target !== 'body') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, isActive, step]);

  if (!isActive || !step) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
        onClick={closeTour}
      />
      
      {/* Highlight pour l'élément cible */}
      {step.target !== 'body' && (
        <div
          className="fixed pointer-events-none z-[10000]"
          style={{
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            transition: 'all 0.3s ease',
            ...(() => {
              const element = document.querySelector(step.target);
              if (element) {
                const rect = element.getBoundingClientRect();
                return {
                  top: `${rect.top - 8}px`,
                  left: `${rect.left - 8}px`,
                  width: `${rect.width + 16}px`,
                  height: `${rect.height + 16}px`,
                  borderRadius: '8px',
                };
              }
              return {};
            })(),
          }}
        />
      )}

      {/* Step component */}
      <TourStepComponent
        step={step}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTour}
        onClose={closeTour}
        totalSteps={totalSteps}
        position={targetPosition}
      />
    </>
  );
}

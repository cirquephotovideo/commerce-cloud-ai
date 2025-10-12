import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { TourStep } from "@/lib/tourSteps";

interface TourStepProps {
  step: TourStep;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
  totalSteps: number;
  position: { top: number; left: number } | null;
}

export function TourStepComponent({ 
  step, 
  onNext, 
  onPrev, 
  onSkip, 
  onClose,
  totalSteps,
  position 
}: TourStepProps) {
  const isFirst = step.step === 1;
  const isLast = step.step === totalSteps;

  const getPositionStyles = () => {
    if (step.placement === 'center' || !position) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
      };
    }

    const { top, left } = position;
    const offset = 16; // Espacement depuis l'élément cible

    const styles: React.CSSProperties = {
      position: 'fixed' as const,
      zIndex: 10001,
    };

    switch (step.placement) {
      case 'top':
        return { ...styles, bottom: `calc(100% - ${top}px + ${offset}px)`, left: `${left}px` };
      case 'bottom':
        return { ...styles, top: `${top + offset}px`, left: `${left}px` };
      case 'left':
        return { ...styles, top: `${top}px`, right: `calc(100% - ${left}px + ${offset}px)` };
      case 'right':
        return { ...styles, top: `${top}px`, left: `${left + offset}px` };
      default:
        return styles;
    }
  };

  return (
    <Card 
      className="w-[400px] shadow-2xl border-2"
      style={getPositionStyles()}
    >
      <CardHeader className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardTitle className="text-lg pr-8">{step.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Étape {step.step} sur {totalSteps}
        </p>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm">{step.description}</p>
      </CardContent>

      <CardFooter className="flex justify-between gap-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onSkip}
        >
          Passer
        </Button>
        
        <div className="flex gap-2">
          {!isFirst && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onPrev}
            >
              Précédent
            </Button>
          )}
          
          <Button 
            size="sm"
            onClick={onNext}
          >
            {isLast ? 'Terminer' : 'Suivant'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

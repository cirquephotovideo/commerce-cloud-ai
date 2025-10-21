import { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

interface ConfigurationPanelProps {
  children: ReactNode;
}

export const ConfigurationPanel = ({ children }: ConfigurationPanelProps) => {
  return (
    <Card className="h-full border-r">
      <ScrollArea className="h-[calc(100vh-250px)]">
        <div className="p-6 space-y-6">
          {children}
        </div>
      </ScrollArea>
    </Card>
  );
};

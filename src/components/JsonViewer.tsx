import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JsonViewerProps {
  data: any;
}

export const JsonViewer = ({ data }: JsonViewerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderValue = (value: any, key?: string, depth: number = 0): JSX.Element => {
    const indent = depth * 16;

    if (value === null) {
      return <span className="text-muted-foreground">null</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-blue-400">{value.toString()}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-green-400">{value}</span>;
    }

    if (typeof value === "string") {
      return <span className="text-orange-400">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground">[]</span>;
      }
      return (
        <div>
          <span className="text-muted-foreground">[</span>
          {value.map((item, index) => (
            <div key={index} style={{ paddingLeft: `${indent + 16}px` }}>
              {renderValue(item, undefined, depth + 1)}
              {index < value.length - 1 && <span className="text-muted-foreground">,</span>}
            </div>
          ))}
          <div style={{ paddingLeft: `${indent}px` }}>
            <span className="text-muted-foreground">]</span>
          </div>
        </div>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-muted-foreground">{"{}"}</span>;
      }
      return (
        <div>
          <span className="text-muted-foreground">{"{"}</span>
          {entries.map(([k, v], index) => (
            <div key={k} style={{ paddingLeft: `${indent + 16}px` }}>
              <span className="text-purple-400">"{k}"</span>
              <span className="text-muted-foreground">: </span>
              {renderValue(v, k, depth + 1)}
              {index < entries.length - 1 && <span className="text-muted-foreground">,</span>}
            </div>
          ))}
          <div style={{ paddingLeft: `${indent}px` }}>
            <span className="text-muted-foreground">{"}"}</span>
          </div>
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  const jsonData = typeof data === "string" ? JSON.parse(data) : data;

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {isExpanded ? "Masquer les détails" : "Voir les détails"}
      </Button>
      
      {isExpanded && (
        <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
          {renderValue(jsonData)}
        </div>
      )}
    </div>
  );
};

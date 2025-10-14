import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MCPLibrary } from "@/lib/mcpLibraries";

interface MCPUseCasesTabProps {
  library: MCPLibrary;
}

export function MCPUseCasesTab({ library }: MCPUseCasesTabProps) {
  if (!library.useCases || library.useCases.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun cas d'usage documenté pour cette librairie.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {library.useCases.map((useCase, idx) => (
        <Card key={idx}>
          <CardHeader>
            <CardTitle className="text-lg">{useCase.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {useCase.description}
            </p>

            {useCase.steps && useCase.steps.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Étapes :</p>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  {useCase.steps.map((step, stepIdx) => (
                    <li key={stepIdx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {useCase.code && (
              <div className="bg-muted rounded-lg p-3 mt-3">
                <p className="text-xs font-semibold mb-2">Code :</p>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto">
                  {useCase.code}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

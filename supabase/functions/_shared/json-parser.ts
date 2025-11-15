export function parseJSONFromText(text: string): any {
  // Essayer de parser directement
  try {
    return JSON.parse(text);
  } catch {}

  // Extraire JSON entre balises markdown
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || 
                    text.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch {}
  }

  throw new Error('Failed to parse JSON from AI response');
}

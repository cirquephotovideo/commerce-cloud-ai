export function parseJSONFromText(text: string): any {
  // Strategy 1: Direct parse (clean JSON)
  try {
    return JSON.parse(text);
  } catch (directError) {
    console.log('[JSON-PARSER] Direct parse failed, trying fallbacks...');
  }

  // Strategy 2: Extract from markdown code blocks
  const markdownMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
  if (markdownMatch) {
    try {
      return JSON.parse(markdownMatch[1]);
    } catch (markdownError) {
      console.log('[JSON-PARSER] Markdown extraction failed');
    }
  }

  // Strategy 3: Find first complete JSON object/array
  const jsonMatch = text.match(/[\{\[][\s\S]*[\}\]]/);
  if (jsonMatch) {
    try {
      // Clean common issues
      let cleaned = jsonMatch[0]
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control chars
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys
      
      return JSON.parse(cleaned);
    } catch (cleanError) {
      console.log('[JSON-PARSER] Cleaned JSON parse failed');
    }
  }

  // Strategy 4: Try to extract key-value pairs manually
  try {
    const kvMatch = text.match(/["']?(\w+)["']?\s*:\s*["']?([^,}\]]+)["']?/g);
    if (kvMatch && kvMatch.length > 3) {
      const obj: any = {};
      kvMatch.forEach(pair => {
        const [key, ...valueParts] = pair.split(':');
        const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
        obj[key.trim().replace(/^["']|["']$/g, '')] = value;
      });
      if (Object.keys(obj).length > 0) {
        console.log('[JSON-PARSER] Extracted via key-value parsing');
        return obj;
      }
    }
  } catch (kvError) {
    console.log('[JSON-PARSER] Key-value extraction failed');
  }

  throw new Error('Failed to parse JSON from AI response after all strategies');
}

import { encode } from "gpt-tokenizer";

export function countTokens(text: string): number {
  if (text.length === 0) return 0;

  if (text.length <= 200) {
    return encode(text).length;
  }

  const lines = text.split("\n");
  if (lines.length <= 100) {
    return encode(text).length;
  }

  let sampleText = "";
  let sampleLines = 0;
  for (let i = 0; i < lines.length; i += Math.max(1, Math.floor(lines.length / 100))) {
    sampleText += lines[i] + "\n";
    sampleLines++;
  }

  const sampleTokens = encode(sampleText).length;
  return Math.round((sampleTokens / sampleLines) * lines.length);
}

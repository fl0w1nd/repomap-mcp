/**
 * Render code snippets with structural context.
 * Given "lines of interest" (LOIs), shows those lines plus necessary
 * parent context (class/function headers, indentation structure).
 */

export interface TreeContextOptions {
  color?: boolean;
  margin?: number;
}

export function renderTreeContext(
  code: string,
  linesOfInterest: number[],
  _options: TreeContextOptions = {},
): string {
  if (linesOfInterest.length === 0) return "";

  const lines = code.split("\n");
  const loiSet = new Set(linesOfInterest);
  const visibleLines = new Set<number>();

  for (const loi of loiSet) {
    visibleLines.add(loi);
    addParentContext(lines, loi, visibleLines);
  }

  const sortedVisible = Array.from(visibleLines).sort((a, b) => a - b);
  const output: string[] = [];
  let lastLine = -1;

  for (const lineNum of sortedVisible) {
    if (lineNum < 1 || lineNum > lines.length) continue;

    if (lastLine !== -1 && lineNum > lastLine + 1) {
      const indent = getIndent(lines[lineNum - 1]);
      output.push(`${padLineNum(0)}${" ".repeat(indent)}⋮...`);
    }

    const line = lines[lineNum - 1];
    output.push(`${padLineNum(lineNum)}${line}`);
    lastLine = lineNum;
  }

  return output.join("\n");
}

function addParentContext(
  lines: string[],
  lineNum: number,
  visible: Set<number>,
): void {
  const targetIndent = getIndent(lines[lineNum - 1]);
  let currentIndent = targetIndent;

  for (let i = lineNum - 1; i >= 1; i--) {
    const line = lines[i - 1];
    if (line.trim() === "") continue;

    const indent = getIndent(line);
    if (indent < currentIndent) {
      visible.add(i);
      currentIndent = indent;
      if (indent === 0) break;
    }
  }
}

function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function padLineNum(num: number): string {
  if (num === 0) return "      ";
  return String(num).padStart(5, " ") + " ";
}

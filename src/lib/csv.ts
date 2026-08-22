export function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header.map((h) => csvEscape(h)).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => csvEscape(String(cell))).join(","));
  }
  return lines.join("\n");
}

/** Minimal CSV line parser: supports double-quoted fields with escaped `""`, but not embedded newlines within a field. */
export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
          if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
          } else if (char === '"') {
            inQuotes = false;
          } else {
            current += char;
          }
        } else if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          cells.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      cells.push(current);
      return cells.map((c) => c.trim());
    });
}

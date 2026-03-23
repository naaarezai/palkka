export interface ParsedSchedule {
  dayType: "weekday" | "saturday" | "sunday";
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  breaks: { start: string; end: string }[];
  routeId: string;   // e.g. "V110"
  rawText: string;
}

/**
 * Normalize time string: "14.20" or "14:20" → "14:20"
 */
function normalizeTime(t: string): string {
  return t.replace(".", ":");
}

/**
 * Extract text content from a PDF file using dynamically loaded pdfjs-dist
 */
async function extractTextFromPdf(file: File): Promise<string> {
  // Dynamic import to avoid Next.js webpack bundling issues
  const pdfjsLib = await import("pdfjs-dist");
  
  // Use unpkg CDN which always mirrors npm versions (cdnjs may lag behind)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n");
}

/**
 * Parse day type from PDF text
 */
function parseDayType(text: string): "weekday" | "saturday" | "sunday" {
  const upper = text.toUpperCase();
  if (upper.includes("SUNNUNTAISIN") || upper.includes("SUNNUNTAI")) {
    return "sunday";
  }
  if (upper.includes("LAUANTAISIN") || upper.includes("LAUANTAI")) {
    return "saturday";
  }
  return "weekday";
}

/**
 * Parse route ID (e.g. "V110", "V709")
 */
function parseRouteId(text: string): string {
  // Look for patterns like "V110", "V709", "H123" etc.
  const match = text.match(/\b[VHvh]\d{2,4}\b/);
  return match ? match[0].toUpperCase() : "";
}

/**
 * Parse work hours from "Tunnit:" line.
 * Looks for patterns like "14.20-21.20" or "14:20 - 21:20" or "14.20 21.20"
 */
function parseWorkHours(text: string): { start: string; end: string } | null {
  // Find "Tunnit:" and grab the time range after it
  const tunnitMatch = text.match(
    /Tunnit\s*[:\s]\s*(\d{1,2}[.:]\d{2})\s*[-–\s]\s*(\d{1,2}[.:]\d{2})/i
  );

  if (tunnitMatch) {
    return {
      start: normalizeTime(tunnitMatch[1]),
      end: normalizeTime(tunnitMatch[2]),
    };
  }

  // Fallback: look for any time range pattern in the text
  const fallback = text.match(
    /(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})/
  );
  if (fallback) {
    return {
      start: normalizeTime(fallback[1]),
      end: normalizeTime(fallback[2]),
    };
  }

  return null;
}

/**
 * Parse breaks from "Tauot:" line.
 * Handles single break like "17.38-18.23" and multiple breaks like "14.42 15.33" "18.02 19.18"
 */
function parseBreaks(text: string): { start: string; end: string }[] {
  const breaks: { start: string; end: string }[] = [];

  // Find the "Tauot:" section
  const tauotIdx = text.search(/Tauot\s*[:\s]/i);
  if (tauotIdx === -1) return breaks;

  // Get text after "Tauot:" up to the next section or end
  const afterTauot = text.substring(tauotIdx);
  // Limit to a reasonable chunk (next 200 chars or next section keyword)
  const nextSection = afterTauot.search(
    /\n|Tunnit|Linja|Ajolista|Autonumero|Paikka/i
  );
  const tauotSection =
    nextSection > 10
      ? afterTauot.substring(0, nextSection)
      : afterTauot.substring(0, 200);

  // Match all time pairs: "14.42-15.33" or "14.42 15.33" or "14:42-15:33"
  const timePattern =
    /(\d{1,2}[.:]\d{2})\s*[-–\s]\s*(\d{1,2}[.:]\d{2})/g;
  let match;
  while ((match = timePattern.exec(tauotSection)) !== null) {
    // Skip the "Tauot:" keyword itself
    if (match.index < 6) continue;
    breaks.push({
      start: normalizeTime(match[1]),
      end: normalizeTime(match[2]),
    });
  }

  return breaks;
}

/**
 * Main function: parse a PDF schedule file and return structured data
 */
export async function parsePdfSchedule(
  file: File
): Promise<ParsedSchedule> {
  const rawText = await extractTextFromPdf(file);

  const dayType = parseDayType(rawText);
  const workHours = parseWorkHours(rawText);
  const breaks = parseBreaks(rawText);
  const routeId = parseRouteId(rawText);

  if (!workHours) {
    throw new Error(
      "Työtunteja ei löytynyt PDF:stä. Varmista, että kyseessä on ajolista-PDF."
    );
  }

  return {
    dayType,
    startTime: workHours.start,
    endTime: workHours.end,
    breaks,
    routeId,
    rawText,
  };
}

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
 * Parse breaks from "Tauot:" section.
 * Handles various formats:
 *  - "17.38-18.23"
 *  - "14.42 15.33  18.02 19.18"
 *  - "14:42 - 15:33"
 */
function parseBreaks(text: string): { start: string; end: string }[] {
  const breaks: { start: string; end: string }[] = [];

  // Find the "Tauot" keyword (with optional colon/space after)
  const tauotMatch = text.match(/Tauot\s*:?\s*/i);
  if (!tauotMatch || tauotMatch.index === undefined) return breaks;

  // Get text AFTER the "Tauot:" keyword
  const startPos = tauotMatch.index + tauotMatch[0].length;
  const afterTauot = text.substring(startPos);

  // Limit to a reasonable section (up to next known keyword or 500 chars)
  const nextKeyword = afterTauot.search(
    /(?:Tunnit|Linja|Ajolista|Autonumero|Paikka|Kuljettaja|Lähtö|Auto)\s*:/i
  );
  const tauotSection =
    nextKeyword > 0
      ? afterTauot.substring(0, nextKeyword)
      : afterTauot.substring(0, 500);

  console.log("[PDF Parser] Tauot section:", JSON.stringify(tauotSection));

  // Strategy 1: Find dash-separated time pairs like "14.42-15.33" or "14:42 - 15:33"
  const dashPattern = /(\d{1,2}[.:]\d{2})\s*[-–]\s*(\d{1,2}[.:]\d{2})/g;
  let match;
  while ((match = dashPattern.exec(tauotSection)) !== null) {
    breaks.push({
      start: normalizeTime(match[1]),
      end: normalizeTime(match[2]),
    });
  }

  // Strategy 2: If no dash-separated pairs found, collect all standalone times
  // and pair them up: [start1, end1, start2, end2, ...]
  if (breaks.length === 0) {
    const allTimes: string[] = [];
    const timePattern = /(\d{1,2}[.:]\d{2})/g;
    let timeMatch;
    while ((timeMatch = timePattern.exec(tauotSection)) !== null) {
      allTimes.push(normalizeTime(timeMatch[1]));
    }

    console.log("[PDF Parser] All break times found:", allTimes);

    // Pair them up: index 0-1 = break 1, index 2-3 = break 2, etc.
    for (let i = 0; i + 1 < allTimes.length; i += 2) {
      breaks.push({
        start: allTimes[i],
        end: allTimes[i + 1],
      });
    }
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

  // Debug: log the full extracted text so we can see the PDF structure
  console.log("[PDF Parser] ===== RAW TEXT =====");
  console.log(rawText);
  console.log("[PDF Parser] ====================");

  const dayType = parseDayType(rawText);
  const workHours = parseWorkHours(rawText);
  const breaks = parseBreaks(rawText);
  const routeId = parseRouteId(rawText);

  console.log("[PDF Parser] Parsed result:", {
    dayType,
    workHours,
    breaks,
    routeId,
  });

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


export interface ParsedSchedule {
  dayType: "weekday" | "saturday" | "sunday";
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  breaks: { start: string; end: string }[];
  routeId: string;   // e.g. "V709"
  rawText: string;
}

/**
 * Normalize time string: "14.42" or "14:42" → "14:42"
 */
function normalizeTime(t: string): string {
  return t.replace(".", ":");
}

/**
 * Extract text content from a PDF file using dynamically loaded pdfjs-dist
 */
async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
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
 * Parse route ID from "AJOLISTA n:o V709" pattern
 */
function parseRouteId(text: string): string {
  const match = text.match(/AJOLISTA\s+n:o\s+([A-Za-z]?\d{2,4})/i);
  if (match) return match[1].toUpperCase();

  // Fallback: look for V/H + digits
  const fallback = text.match(/\b[VHvh]\d{2,4}\b/);
  return fallback ? fallback[0].toUpperCase() : "";
}

/**
 * Parse work hours from "AJOLISTA n:o V709 10.55 – 21.20" pattern
 * This is the main time range in the summary section at the bottom
 */
function parseWorkHours(text: string): { start: string; end: string } | null {
  // Primary: "AJOLISTA n:o V709  10.55 – 21.20"
  const ajolistaMatch = text.match(
    /AJOLISTA\s+n:o\s+\S+\s+(\d{1,2}[.:]\d{2})\s*[–\-]\s*(\d{1,2}[.:]\d{2})/i
  );
  if (ajolistaMatch) {
    return {
      start: normalizeTime(ajolistaMatch[1]),
      end: normalizeTime(ajolistaMatch[2]),
    };
  }

  // Fallback: Look for "Tunnit :" followed by a time range in the summary section
  // (but only the summary at the bottom, not the column header)
  // The summary has format: "Tunnit :   8 h 18 min" which is duration, not range
  // So we look for any "HH.MM – HH.MM" pattern that looks like a work range
  const rangeMatch = text.match(
    /(\d{1,2}[.:]\d{2})\s*[–\-]\s*(\d{1,2}[.:]\d{2})\s*\/\s*\d+\s*h\s*\d+\s*min/
  );
  if (rangeMatch) {
    return {
      start: normalizeTime(rangeMatch[1]),
      end: normalizeTime(rangeMatch[2]),
    };
  }

  return null;
}

/**
 * Parse breaks from "Tauko, ..., Klo : 14.42 – 15.33" patterns
 * Also handles summary format: "14.42 – 15.33 / 51 min"
 */
function parseBreaks(text: string): { start: string; end: string }[] {
  const breaks: { start: string; end: string }[] = [];
  const seen = new Set<string>();

  // Strategy 1: Find explicit "Tauko" lines
  // Format: "Tauko, Lahti, Kauppatori, Klo :   14.42 – 15.33"
  const taukoPattern = /Tauko[^:]*(?:Klo|klo)\s*:\s*(\d{1,2}[.:]\d{2})\s*[–\-]\s*(\d{1,2}[.:]\d{2})/g;
  let match;
  while ((match = taukoPattern.exec(text)) !== null) {
    const key = `${match[1]}-${match[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      breaks.push({
        start: normalizeTime(match[1]),
        end: normalizeTime(match[2]),
      });
    }
  }

  // Strategy 2: If no "Tauko" markers found, look for break times in the summary section
  // Format: "14.42 – 15.33 / 51 min" (with duration after slash)
  if (breaks.length === 0) {
    const summaryPattern = /(\d{1,2}[.:]\d{2})\s*[–\-]\s*(\d{1,2}[.:]\d{2})\s*\/\s*(?:\d+\s*h\s*)?\d+\s*min/g;
    while ((match = summaryPattern.exec(text)) !== null) {
      const start = normalizeTime(match[1]);
      const end = normalizeTime(match[2]);
      
      // Skip the main work hours range (it also has "/ X h Y min" format)
      // The work range is typically > 4h, breaks typically < 2h
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      let durationMin = (eh * 60 + em) - (sh * 60 + sm);
      if (durationMin < 0) durationMin += 1440;
      
      if (durationMin <= 120) { // Break = max 2h, skip if longer
        const key = `${match[1]}-${match[2]}`;
        if (!seen.has(key)) {
          seen.add(key);
          breaks.push({ start, end });
        }
      }
    }
  }

  console.log("[PDF Parser] Found breaks:", breaks);
  return breaks;
}

/**
 * Main function: parse a PDF schedule file and return structured data
 */
export async function parsePdfSchedule(
  file: File
): Promise<ParsedSchedule> {
  const rawText = await extractTextFromPdf(file);

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

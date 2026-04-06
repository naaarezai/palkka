import { isPublicHoliday } from './holidays';

export interface ShiftInput {
  startTime: Date;
  endTime: Date;
  breaks: { start: Date; end: Date }[];
  baseWage?: number;
  ktaWage?: number;
  maxUnpaidBreakMinutes?: number;
}

export interface CalculationResult {
  totalMinutes: number;
  paidMinutes: number;
  normalMinutes: number;
  waitingMinutes: number;    // > 60 min breaks
  overtime50Minutes: number;
  overtime100Minutes: number;
  eveningMinutes: number;
  nightMinutes: number;
  sundayMinutes: number;
  saturdayMinutes: number;
  holidayMinutes: number;
  
  // Euro amounts based on AKT percentages
  normalPay?: number;
  waitingPay?: number;       // 100% of base wage for excess break
  overtime50Pay?: number;
  overtime100Pay?: number;
  eveningPay?: number;       // 15%
  nightPay?: number;         // 20%
  sundayPay?: number;        // 100%
  saturdayPay?: number;      // 10% (15:00 - 18:00)
  holidayPay?: number;       // 100% (arkipyhät)
  totalPay?: number;
}

export function calculateSalary(input: ShiftInput): CalculationResult {
  const { startTime, endTime, breaks, baseWage = 16.50, ktaWage, maxUnpaidBreakMinutes = 60 } = input;
  const effectiveKta = ktaWage || baseWage;
  
  let totalMinutes = 0;
  let paidMinutes = 0;
  let waitingMinutes = 0;
  let eveningMinutes = 0;
  let nightMinutes = 0;
  let sundayMinutes = 0;
  let saturdayMinutes = 0;
  let holidayMinutes = 0;

  let cumulativeUnpaidBreakMinutes = 0;

  // We iterate minute by minute
  for (let m = new Date(startTime); m < endTime; m.setMinutes(m.getMinutes() + 1)) {
    totalMinutes++;
    
    // Check if within any break
    let isBreakMinute = false;
    for (const brk of breaks) {
      if (m >= brk.start && m < brk.end) {
        isBreakMinute = true;
        break;
      }
    }

    if (isBreakMinute) {
      // Rule: Cumulative first X mins of ALL breaks are unpaid. Excess is waiting time.
      if (cumulativeUnpaidBreakMinutes < maxUnpaidBreakMinutes) {
        cumulativeUnpaidBreakMinutes++;
        // This is an unpaid break minute, do nothing for pay
      } else {
        // This break minute is now paid waiting time
        waitingMinutes++;
        // Apply bonuses to waiting time too
        applyBonuses(m);
      }
    } else {
      // Normal working minute
      paidMinutes++;
      applyBonuses(m);
    }

    function applyBonuses(time: Date) {
      const hours = time.getHours();
      const day = time.getDay();
      const holiday = isPublicHoliday(time);

      if (hours >= 18 && hours < 22) {
        eveningMinutes++;
      }
      if (hours >= 22 || hours < 6) {
        nightMinutes++;
      }
      if (day === 6 && hours >= 15 && hours < 18) {
        saturdayMinutes++;
      }
      if (day === 0 && !holiday) {
        sundayMinutes++;
      } else if (holiday && day !== 0) {
        holidayMinutes++;
      } else if (day === 0 && holiday) {
        sundayMinutes++;
      }
    }
  }

  // Pay calculation
  const basePerMin = baseWage / 60;
  const ktaPerMin = effectiveKta / 60;
  const normalPay = paidMinutes * basePerMin;
  const waitingPay = waitingMinutes * basePerMin;
  
  const eveningPay = eveningMinutes * ktaPerMin * 0.15;
  const nightPay = nightMinutes * ktaPerMin * 0.20;
  const sundayPay = sundayMinutes * ktaPerMin * 1.0;
  const saturdayPay = saturdayMinutes * ktaPerMin * 0.10;
  const holidayPay = holidayMinutes * ktaPerMin * 1.0;
  
  const totalPay = normalPay + waitingPay + eveningPay + nightPay + sundayPay + saturdayPay + holidayPay;

  return {
    totalMinutes,
    paidMinutes,
    normalMinutes: paidMinutes,
    waitingMinutes,
    overtime50Minutes: 0,
    overtime100Minutes: 0,
    eveningMinutes,
    nightMinutes,
    sundayMinutes,
    saturdayMinutes,
    holidayMinutes,
    normalPay,
    waitingPay,
    overtime50Pay: 0,
    overtime100Pay: 0,
    eveningPay,
    nightPay,
    sundayPay,
    saturdayPay,
    holidayPay,
    totalPay
  };
}

// --- Keskiyön jako -logiikka ---

export interface ShiftSegment {
  startTime: Date;
  endTime: Date;
  breaks: { start: Date; end: Date }[];
  date: Date;  // Minkä päivän palkka tämä on (segmentin alkupäivä)
}

export interface SplitShiftResult {
  segments: { date: Date; result: CalculationResult }[];  // Per-päivä tulokset
  combined: CalculationResult;  // Yhdistetty kokonaistulos
}

/**
 * Jakaa vuoron keskiyökohdissa osiin.
 * Jos vuoro ei ylitä keskiyötä, palautetaan yksi osa.
 * Jos ylittää, palautetaan osa per päivä (esim. 22:00-06:00 → [22:00-00:00, 00:00-06:00]).
 */
export function splitShiftAtMidnight(
  startTime: Date,
  endTime: Date,
  breaks: { start: Date; end: Date }[]
): ShiftSegment[] {
  const segments: ShiftSegment[] = [];

  let currentStart = new Date(startTime);

  while (currentStart < endTime) {
    // Laske seuraava keskiyö
    const nextMidnight = new Date(currentStart);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);

    // Segmentin loppu on joko keskiyö tai vuoron loppu, kumpi on ensin
    const segmentEnd = nextMidnight < endTime ? nextMidnight : new Date(endTime);

    // Jaa tauot tälle segmentille
    const segmentBreaks: { start: Date; end: Date }[] = [];
    for (const brk of breaks) {
      const brkStart = new Date(brk.start);
      const brkEnd = new Date(brk.end);

      // Tarkista onko tauko tässä segmentissä (osittainkin)
      if (brkStart < segmentEnd && brkEnd > currentStart) {
        segmentBreaks.push({
          start: brkStart < currentStart ? new Date(currentStart) : brkStart,
          end: brkEnd > segmentEnd ? new Date(segmentEnd) : brkEnd
        });
      }
    }

    segments.push({
      startTime: new Date(currentStart),
      endTime: segmentEnd,
      breaks: segmentBreaks,
      date: new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate())
    });

    currentStart = segmentEnd;
  }

  return segments;
}

/**
 * Laskee vuoron palkan jaettuna keskiyökohdissa.
 *
 * HUOM: Palkaton 60 min taukosääntö lasketaan koko vuoron tasolla,
 * niin koko vuoron tauot vähennetään ensin ja odotusaika jaetaan segmenteille.
 */
export function calculateSplitShiftSalary(input: ShiftInput): SplitShiftResult {
  const { startTime, endTime, breaks, baseWage = 16.50, ktaWage } = input;

  const segments = splitShiftAtMidnight(startTime, endTime, breaks);

  // Jos vuoro ei ylitä keskiyötä (yksi segmentti), palauta normaali laskenta
  if (segments.length <= 1) {
    const result = calculateSalary(input);
    return {
      segments: [{ date: segments[0]?.date || startTime, result }],
      combined: result
    };
  }

  // Laske jokainen segmentti erikseen
  // Palkaton 60 min break -sääntö: lasketaan koko vuoron taukojen yhteismäärä ensin
  const totalBreakMinutes = breaks.reduce((sum, brk) => {
    return sum + Math.max(0, (brk.end.getTime() - brk.start.getTime()) / 60000);
  }, 0);

  const unpaidBreakMinutes = Math.min(totalBreakMinutes, 60);
  const totalWaitingMinutes = Math.max(0, totalBreakMinutes - 60);

  // Laske per-segmentti taukojen minuutit jakoa varten
  const segmentBreakMinutes = segments.map(seg =>
    seg.breaks.reduce((sum, brk) => sum + Math.max(0, (brk.end.getTime() - brk.start.getTime()) / 60000), 0)
  );

  // Jaa palkaton tauko ja odotusaika segmenteille aikajärjestyksessä
  let remainingUnpaid = unpaidBreakMinutes;
  const segmentUnpaidMinutes: number[] = [];
  const segmentWaitingMinutes: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const brkMins = segmentBreakMinutes[i];
    const unpaidForThis = Math.min(brkMins, remainingUnpaid);
    segmentUnpaidMinutes.push(unpaidForThis);
    segmentWaitingMinutes.push(brkMins - unpaidForThis);
    remainingUnpaid -= unpaidForThis;
  }

  // Laske jokainen segmentti calculateSalary:llä, mutta korvaa taukologiikka
  const segmentResults: { date: Date; result: CalculationResult }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // Lasketaan segmentti antamalla sille oikea osuus palkattomasta tauosta
    const segResult = calculateSalary({
      startTime: seg.startTime,
      endTime: seg.endTime,
      breaks: seg.breaks,  // Segmenttiin kuuluvat tauot
      baseWage,
      ktaWage,
      maxUnpaidBreakMinutes: segmentUnpaidMinutes[i]
    });

    segmentResults.push({ date: seg.date, result: segResult });
  }

  // Yhdistä tulokset
  const combined: CalculationResult = {
    totalMinutes: segmentResults.reduce((s, r) => s + r.result.totalMinutes, 0),
    paidMinutes: segmentResults.reduce((s, r) => s + r.result.paidMinutes, 0),
    normalMinutes: segmentResults.reduce((s, r) => s + r.result.normalMinutes, 0),
    waitingMinutes: segmentResults.reduce((s, r) => s + r.result.waitingMinutes, 0),
    overtime50Minutes: 0,
    overtime100Minutes: 0,
    eveningMinutes: segmentResults.reduce((s, r) => s + r.result.eveningMinutes, 0),
    nightMinutes: segmentResults.reduce((s, r) => s + r.result.nightMinutes, 0),
    sundayMinutes: segmentResults.reduce((s, r) => s + r.result.sundayMinutes, 0),
    saturdayMinutes: segmentResults.reduce((s, r) => s + r.result.saturdayMinutes, 0),
    holidayMinutes: segmentResults.reduce((s, r) => s + r.result.holidayMinutes, 0),
    normalPay: segmentResults.reduce((s, r) => s + (r.result.normalPay || 0), 0),
    waitingPay: segmentResults.reduce((s, r) => s + (r.result.waitingPay || 0), 0),
    overtime50Pay: 0,
    overtime100Pay: 0,
    eveningPay: segmentResults.reduce((s, r) => s + (r.result.eveningPay || 0), 0),
    nightPay: segmentResults.reduce((s, r) => s + (r.result.nightPay || 0), 0),
    sundayPay: segmentResults.reduce((s, r) => s + (r.result.sundayPay || 0), 0),
    saturdayPay: segmentResults.reduce((s, r) => s + (r.result.saturdayPay || 0), 0),
    holidayPay: segmentResults.reduce((s, r) => s + (r.result.holidayPay || 0), 0),
    totalPay: segmentResults.reduce((s, r) => s + (r.result.totalPay || 0), 0),
  };

  return { segments: segmentResults, combined };
}


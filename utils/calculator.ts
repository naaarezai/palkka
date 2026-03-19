import { isPublicHoliday } from './holidays';

export interface ShiftInput {
  startTime: Date;
  endTime: Date;
  breaks: { start: Date; end: Date }[];
  baseWage?: number;
  ktaWage?: number;
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
  const { startTime, endTime, breaks, baseWage = 16.50, ktaWage } = input;
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
      // Rule: Cumulative first 60 mins of ALL breaks are unpaid. Excess is waiting time.
      if (cumulativeUnpaidBreakMinutes < 60) {
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


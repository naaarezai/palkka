import { isPublicHoliday } from './holidays';

export interface ShiftInput {
  startTime: Date;
  endTime: Date;
  breaks: { start: Date; end: Date }[];
  baseWage?: number;
}

export interface CalculationResult {
  totalMinutes: number;
  paidMinutes: number;
  normalMinutes: number;
  overtime50Minutes: number;
  overtime100Minutes: number;
  eveningMinutes: number;
  nightMinutes: number;
  sundayMinutes: number;
  saturdayMinutes: number;
  holidayMinutes: number;
  
  // Euro amounts based on AKT percentages
  normalPay?: number;
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
  const { startTime, endTime, breaks, baseWage = 16.50 } = input;
  
  let totalMinutes = 0;
  let paidMinutes = 0;
  let eveningMinutes = 0;
  let nightMinutes = 0;
  let sundayMinutes = 0;
  let saturdayMinutes = 0;
  let holidayMinutes = 0;

  // We iterate minute by minute
  for (let m = new Date(startTime); m < endTime; m.setMinutes(m.getMinutes() + 1)) {
    totalMinutes++;
    
    // Check if within break
    let isBreak = false;
    for (const brk of breaks) {
      if (m >= brk.start && m < brk.end) {
        isBreak = true;
        break;
      }
    }

    if (!isBreak) {
      paidMinutes++;
      const hours = m.getHours();
      const day = m.getDay(); // 0 is Sunday, 6 is Saturday
      const holiday = isPublicHoliday(m);

      // Evening time (18:00 - 22:00)
      if (hours >= 18 && hours < 22) {
        eveningMinutes++;
      }
      
      // Night time (22:00 - 06:00)
      if (hours >= 22 || hours < 6) {
        nightMinutes++;
      }
      
      // Saturday bonus (15:00 - 18:00)
      // PDF line 125: "arkilauantaina klo 15.00-18.00"
      if (day === 6 && hours >= 15 && hours < 18) {
        saturdayMinutes++;
      }
      
      // Sunday OR public holiday → 100% lisä
      // Ei tuplalaskentaa: jos on sunnuntai JA pyhäpäivä, lasketaan vain kerran
      if (day === 0 && !holiday) {
        sundayMinutes++;
      } else if (holiday && day !== 0) {
        holidayMinutes++;
      } else if (day === 0 && holiday) {
        // Sunnuntai + pyhäpäivä → lasketaan sunnuntailisänä (sama 100%)
        sundayMinutes++;
      }
    }
  }

  const normalMinutes = Math.min(paidMinutes, 8 * 60);
  const overtimeMinutes = Math.max(0, paidMinutes - 8 * 60);
  const overtime50Minutes = Math.min(overtimeMinutes, 2 * 60);
  const overtime100Minutes = Math.max(0, overtimeMinutes - 2 * 60);

  // Pay calculation
  const basePerMin = baseWage / 60;
  
  const normalPay = normalMinutes * basePerMin;
  const overtime50Pay = overtime50Minutes * basePerMin * 1.5;
  const overtime100Pay = overtime100Minutes * basePerMin * 2.0;
  
  const eveningPay = eveningMinutes * basePerMin * 0.15;
  const nightPay = nightMinutes * basePerMin * 0.20;
  const sundayPay = sundayMinutes * basePerMin * 1.0;
  const saturdayPay = saturdayMinutes * basePerMin * 0.10;
  const holidayPay = holidayMinutes * basePerMin * 1.0;  // Sama 100% kuin sunnuntai
  
  const totalPay = normalPay + overtime50Pay + overtime100Pay + eveningPay + nightPay + sundayPay + saturdayPay + holidayPay;

  return {
    totalMinutes,
    paidMinutes,
    normalMinutes,
    overtime50Minutes,
    overtime100Minutes,
    eveningMinutes,
    nightMinutes,
    sundayMinutes,
    saturdayMinutes,
    holidayMinutes,
    normalPay,
    overtime50Pay,
    overtime100Pay,
    eveningPay,
    nightPay,
    sundayPay,
    saturdayPay,
    holidayPay,
    totalPay
  };
}

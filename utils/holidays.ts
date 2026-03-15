/**
 * Suomen arkipyhät — käytetään AKT TES:n mukaiseen pyhätyölisän laskentaan.
 * Pyhäpäivinä maksetaan sama 100 % lisä kuin sunnuntaityöstä.
 */

/**
 * Laskee pääsiäissunnuntain päivämäärän annetulle vuodelle.
 * Käyttää Gaussin pääsiäisalgoritmia.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Palauttaa juhannuspäivän (lauantai 20.6.–26.6. väliltä).
 */
function getMidsummerDay(year: number): Date {
  // Juhannuspäivä on lauantai välillä 20.6.–26.6.
  for (let day = 20; day <= 26; day++) {
    const d = new Date(year, 5, day); // June = 5
    if (d.getDay() === 6) return d; // Saturday
  }
  return new Date(year, 5, 20);
}

/**
 * Palauttaa pyhäinpäivän (lauantai 31.10.–6.11. väliltä).
 */
function getAllSaintsDay(year: number): Date {
  for (let day = 31; day <= 37; day++) {
    const actualDay = day <= 31 ? day : day - 31;
    const month = day <= 31 ? 9 : 10; // Oct = 9, Nov = 10
    const d = new Date(year, month, actualDay);
    if (d.getDay() === 6) return d;
  }
  return new Date(year, 10, 1);
}

/**
 * Palauttaa kaikki Suomen arkipyhät annetulle vuodelle.
 */
export function getFinishHolidays(year: number): Date[] {
  const easter = getEasterSunday(year);
  
  // Pitkäperjantai = pääsiäinen - 2 päivää
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  
  // 2. pääsiäispäivä = pääsiäinen + 1 päivä
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  
  // Helatorstai = pääsiäinen + 39 päivää
  const ascensionDay = new Date(easter);
  ascensionDay.setDate(easter.getDate() + 39);
  
  // Juhannusaatto = juhannuspäivä - 1
  const midsummerDay = getMidsummerDay(year);
  const midsummerEve = new Date(midsummerDay);
  midsummerEve.setDate(midsummerDay.getDate() - 1);
  
  const allSaintsDay = getAllSaintsDay(year);

  return [
    new Date(year, 0, 1),    // Uudenvuodenpäivä
    new Date(year, 0, 6),    // Loppiainen
    goodFriday,               // Pitkäperjantai
    easter,                   // Pääsiäispäivä
    easterMonday,             // 2. pääsiäispäivä
    new Date(year, 4, 1),    // Vappu
    ascensionDay,             // Helatorstai
    midsummerEve,             // Juhannusaatto
    midsummerDay,             // Juhannuspäivä
    allSaintsDay,             // Pyhäinpäivä
    new Date(year, 11, 6),   // Itsenäisyyspäivä
    new Date(year, 11, 24),  // Jouluaatto
    new Date(year, 11, 25),  // Joulupäivä
    new Date(year, 11, 26),  // Tapaninpäivä
  ];
}

/**
 * Tarkistaa onko annettu päivä Suomen arkipyhä.
 */
export function isPublicHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getFinishHolidays(year);
  
  return holidays.some(h => 
    h.getFullYear() === date.getFullYear() &&
    h.getMonth() === date.getMonth() &&
    h.getDate() === date.getDate()
  );
}

const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// 1. Fix period header
const periodHeaderOld = `<div className="flex flex-col bg-slate-900/80 rounded-xl p-4 border border-slate-600/30">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Calendar className="text-blue-400" size={20} />
                                <div>
                                  <div className="text-white font-semibold">
                                    {format(firstDate, "dd.MM.")} — {format(lastDate, "dd.MM.yyyy")}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {periodShifts.length} vuoroa · {Math.floor(totalHours)} h {totalMinutes % 60} min
                                    {holidayShifts.length > 0 && <span className="text-red-300 ml-2">🔴 {holidayShifts.length} pyhäpäivä</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-emerald-400 font-black text-xl">{(totalPay + periodOvertimePay).toFixed(2)} €</div>
                                <div className="text-xs text-slate-500">jakson arvioitu palkka</div>
                              </div>
                            </div>`;

const periodHeaderNew = `<div className="flex flex-col sm:flex-row bg-slate-900/80 rounded-xl p-4 border border-slate-600/30 gap-4">
                            <div className="flex items-center justify-between flex-1">
                              <div className="flex items-center gap-3">
                                <Calendar className="text-blue-400 shrink-0" size={20} />
                                <div>
                                  <div className="text-white font-semibold text-sm sm:text-base">
                                    {format(firstDate, "dd.MM.")} — {format(lastDate, "dd.MM.yyyy")}
                                  </div>
                                  <div className="text-[10px] sm:text-xs text-slate-400">
                                    {periodShifts.length} vuoroa · {Math.floor(totalHours)} h {totalMinutes % 60} min
                                    {holidayShifts.length > 0 && <span className="text-red-300 ml-2">🔴 {holidayShifts.length} pyhäpäivä</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/50">
                               <div className="text-emerald-400 font-black text-xl sm:text-2xl">{(totalPay + periodOvertimePay).toFixed(2)} €</div>
                               <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">jakson arvioitu palkka</div>
                            </div>`;

if (content.includes(periodHeaderOld)) {
    content = content.replace(periodHeaderOld, periodHeaderNew);
    console.log('Fixed period header');
} else {
    console.log('Period header target not found');
}

// 2. Fix shift entry
const shiftEntryOld = `<div key={shift.id} className={\`bg-slate-900/50 border p-4 rounded-xl flex justify-between items-center group hover:border-slate-500 transition shadow-sm \${isHoliday ? 'border-red-800/50' : 'border-slate-700'}\`}>
                                  <div className="space-y-1">
                                    <div className="text-white font-semibold flex items-center gap-2">
                                      {format(shiftDate, "dd.MM.yyyy (EEEE)")}
                                      {isHoliday && <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full">Pyhäpäivä</span>}
                                    </div>
                                    <div className="text-sm text-slate-400">
                                      {format(new Date(shift.start_input), "HH:mm")} - {format(new Date(shift.end_input), "HH:mm")}
                                    </div>
                                    <div className="text-emerald-400 font-bold text-lg">
                                      {(Number(shift.total_pay) || 0).toFixed(2)} €
                                    </div>
                                  </div>
                                  <button 
                                   onClick={() => handleDeleteShift(shift.id)}
                                   className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>`;

const shiftEntryNew = `<div key={shift.id} className={\`bg-slate-900/50 border p-4 rounded-xl flex items-center group hover:border-slate-500 transition shadow-sm \${isHoliday ? 'border-red-800/50' : 'border-slate-700'}\`}>
                                  <div className="flex-1 space-y-1">
                                    <div className="text-white font-semibold flex flex-wrap items-center gap-2 text-sm sm:text-base">
                                      {format(shiftDate, "dd.MM.yyyy (EEEE)")}
                                      {isHoliday && <span className="text-[10px] bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full">Pyhäpäivä</span>}
                                    </div>
                                    <div className="text-xs sm:text-sm text-slate-400">
                                      {format(new Date(shift.start_input), "HH:mm")} - {format(new Date(shift.end_input), "HH:mm")}
                                    </div>
                                    <div className="text-emerald-400 font-bold text-base sm:text-lg">
                                      {(Number(shift.total_pay) || 0).toFixed(2)} €
                                    </div>
                                  </div>
                                  <button 
                                   onClick={() => handleDeleteShift(shift.id)}
                                   className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition opacity-100 sm:opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>`;

if (content.includes(shiftEntryOld)) {
    content = content.replace(shiftEntryOld, shiftEntryNew);
    console.log('Fixed shift entry');
} else {
    console.log('Shift entry target not found');
}

fs.writeFileSync('app/page.tsx', content);

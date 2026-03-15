"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { calculateSalary, CalculationResult } from "../utils/calculator";
import { Settings, Clock, Calculator, List, Save, User as UserIcon, Trash2, LogOut, Loader2 } from "lucide-react";
import { supabase } from "../utils/supabase";
import AuthModal from "./AuthModal";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"calculator" | "shifts">("calculator");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [session, setSession] = useState<Record<string, any> | null>(null);
  
  // Settings
  const [baseWage, setBaseWage] = useState("16.50");
  const [experience, setExperience] = useState("default");
  const [eveningBonus, setEveningBonus] = useState("15");
  const [nightBonus, setNightBonus] = useState("20");
  const [sundayBonus, setSundayBonus] = useState("100");

  const WAGE_TABLE = {
    "default": "16.50",
    "under4": "16.22",
    "4to8": "16.46",
    "8to12": "16.95",
    "over12": "17.28",
    "hsl_under4": "17.89",
    "hsl_4to8": "18.57",
    "hsl_8to12": "19.28",
    "hsl_over12": "19.73"
  };

  // Inputs
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");

  const [result, setResult] = useState<CalculationResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [savedShifts, setSavedShifts] = useState<Record<string, any>[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load local settings on mount
    const savedWage = localStorage.getItem("base-wage") || "16.50";
    setBaseWage(savedWage);
    setExperience(localStorage.getItem("experience") || "default");
    setEveningBonus(localStorage.getItem("evening-bonus") || "15");
    setNightBonus(localStorage.getItem("night-bonus") || "20");
    setSundayBonus(localStorage.getItem("sunday-bonus") || "100");

    // Auth session
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) fetchShifts();
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) fetchShifts();
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const fetchShifts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .order("date", { ascending: false });
    
    if (error) {
      console.error("Error fetching shifts:", error);
    } else {
      setSavedShifts(data || []);
    }
  };

  const handleSaveShift = async () => {
    if (!session || !result || !supabase) {
      alert("Kirjaudu sisään tallentaaksesi vuoroja!");
      setIsAuthModalOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("shifts").insert({
        user_id: session.user.id,
        date: new Date(startInput).toISOString(),
        start_input: startInput,
        end_input: endInput,
        break_start_str: breakStart,
        break_end_str: breakEnd,
        total_minutes: result.totalMinutes,
        paid_minutes: result.paidMinutes,
        normal_minutes: result.normalMinutes,
        normal_pay: result.normalPay,
        overtime50_minutes: result.overtime50Minutes,
        ot50_pay: result.overtime50Pay,
        overtime100_minutes: result.overtime100Minutes,
        ot100_pay: result.overtime100Pay,
        evening_minutes: result.eveningMinutes,
        evening_pay: result.eveningPay,
        night_minutes: result.nightMinutes,
        night_pay: result.nightPay,
        saturday_minutes: result.saturdayMinutes,
        saturday_pay: result.saturdayPay,
        sunday_minutes: result.sundayMinutes,
        sunday_pay: result.sundayPay,
        total_pay: result.totalPay,
        experience_level: experience,
        base_wage: parseFloat(baseWage)
      });

      if (error) throw error;
      
      alert("Vuoro tallennettu onnistuneesti!");
      fetchShifts();
      setActiveTab("shifts");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tuntematon virhe";
      alert("Virhe tallennuksessa: " + message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!supabase) return;
    if (!confirm("Haluatko varmasti poistaa tämän vuoron?")) return;

    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (error) {
      alert("Virhe poistossa: " + error.message);
    } else {
      fetchShifts();
    }
  };

  const saveSettings = (newWage?: string, newExp?: string) => {
    localStorage.setItem("base-wage", newWage || baseWage);
    localStorage.setItem("experience", newExp || experience);
    localStorage.setItem("evening-bonus", eveningBonus);
    localStorage.setItem("night-bonus", nightBonus);
    localStorage.setItem("sunday-bonus", sundayBonus);
  };

  const handleExperienceChange = (exp: string) => {
    setExperience(exp);
    const wage = WAGE_TABLE[exp as keyof typeof WAGE_TABLE];
    if (wage) {
      setBaseWage(wage);
      saveSettings(wage, exp);
    }
  };

  const handleCalculate = () => {
    if (!startInput || !endInput) {
      alert("Syötä vuoron alku ja loppu!");
      return;
    }

    const startTime = new Date(startInput);
    const endTime = new Date(endInput);
    
    if (endTime <= startTime) {
      alert("Vuoron lopun täytyy olla alun jälkeen!");
      return;
    }

    const breaks = [];
    if (breakStart && breakEnd) {
      const bStart = new Date(startTime);
      const [sh, sm] = breakStart.split(":").map(Number);
      bStart.setHours(sh, sm, 0, 0);
      if (bStart < startTime) bStart.setDate(bStart.getDate() + 1);

      const bEnd = new Date(bStart);
      const [eh, em] = breakEnd.split(":").map(Number);
      bEnd.setHours(eh, em, 0, 0);
      if (bEnd < bStart) bEnd.setDate(bEnd.getDate() + 1);

      breaks.push({ start: bStart, end: bEnd });
    }

    saveSettings();

    const calcObj = calculateSalary({
      startTime,
      endTime,
      breaks,
      baseWage: parseFloat(baseWage) || 0
    });

    setResult(calcObj);
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">AKT Palkanlaskenta</h1>
          <p className="text-slate-400 mt-1">Kuljetusalan TES-pohjainen laskuri</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400 hidden sm:inline">{session.user.email}</span>
              <button 
                onClick={() => supabase?.auth.signOut()}
                className="flex items-center space-x-2 text-sm bg-slate-700 hover:bg-slate-600 transition px-4 py-2 rounded-lg text-slate-200"
              >
                <LogOut size={16} />
                <span>Kirjaudu ulos</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center space-x-2 text-sm bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-lg text-white font-medium shadow-lg shadow-blue-950/20"
            >
              <UserIcon size={16} />
              <span>Luo tili / Kirjaudu</span>
            </button>
          )}
        </div>
      </header>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Tabs */}
      <div className="flex space-x-2 mb-6">
        <button 
          onClick={() => setActiveTab("calculator")}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition flex items-center justify-center space-x-2 ${activeTab === "calculator" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`}
        >
          <Calculator size={18} />
          <span>Laskuri</span>
        </button>
        <button 
          onClick={() => setActiveTab("shifts")}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition flex items-center justify-center space-x-2 ${activeTab === "shifts" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`}
        >
          <List size={18} />
          <span>Omat vuorot</span>
        </button>
      </div>

      {activeTab === "calculator" && (
        <div className="space-y-6">
          
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2 text-slate-200">
              <Settings className="text-blue-400" />
              <span>Asetukset (AUT 2025-2026)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Palveluvuodet (TES Taulukko)</label>
                <select 
                  value={experience} 
                  onChange={(e) => handleExperienceChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                >
                  <option value="default">Määritä itse...</option>
                  <optgroup label="AKT Linja-auto (Normaali)">
                    <option value="under4">Alle 4 vuotta (16,22 €)</option>
                    <option value="4to8">4-8 vuotta (16,46 €)</option>
                    <option value="8to12">8-12 vuotta (16,95 €)</option>
                    <option value="over12">Yli 12 vuotta (17,28 €)</option>
                  </optgroup>
                  <optgroup label="AKT Linja-auto (HSL-ajot)">
                    <option value="hsl_under4">Alle 4 vuotta (17,89 €)</option>
                    <option value="hsl_4to8">4-8 vuotta (18,57 €)</option>
                    <option value="hsl_8to12">8-12 vuotta (19,28 €)</option>
                    <option value="hsl_over12">Yli 12 vuotta (19,73 €)</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Perustuntipalkka (€/h)</label>
                <input type="number" step="0.01" value={baseWage} onChange={(e) => { setBaseWage(e.target.value); setExperience("default"); }} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Sunnuntai/vapaapäivätyölisä (%)</label>
                <input type="number" value={sundayBonus} onChange={(e) => setSundayBonus(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-400 mb-1">Iltalisä (%)</label>
                  <input type="number" value={eveningBonus} onChange={(e) => setEveningBonus(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-400 mb-1">Yölisä (%)</label>
                  <input type="number" value={nightBonus} onChange={(e) => setNightBonus(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
                </div>
              </div>
            </div>
          </div>

          {/* Shift Input Card */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2 text-slate-200">
              <Clock className="text-blue-400" />
              <span>Vuoron syöttö</span>
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Vuoron alku</label>
                <input type="datetime-local" value={startInput} onChange={(e) => setStartInput(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Vuoron loppu</label>
                <input type="datetime-local" value={endInput} onChange={(e) => setEndInput(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition [color-scheme:dark]" />
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 mb-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Tauko</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tauko alkaa</label>
                  <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tauko päättyy</label>
                  <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition [color-scheme:dark]" />
                </div>
              </div>
            </div>

            <button onClick={handleCalculate} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition transform hover:-translate-y-0.5 mt-2">
              Laske Palkka
            </button>
          </div>

          {/* Results Card */}
          {result && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-600/30 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
              <h2 className="text-2xl font-bold mb-6 text-white border-b border-slate-700 pb-4">Laskelman tulos</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-700/50">
                  <div className="text-slate-400 text-sm mb-1">Bruttotyöaika</div>
                  <div className="text-xl font-semibold text-white">{formatDuration(result.totalMinutes)}</div>
                </div>
                <div className="bg-blue-950/30 rounded-xl p-4 border border-blue-900/50">
                  <div className="text-blue-300 text-sm mb-1">Palkallinen aika</div>
                  <div className="text-xl font-semibold text-blue-100">{formatDuration(result.paidMinutes)}</div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Palkan ja lisien erittely</h3>
                
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Normaali työaika <span className="text-slate-500 text-sm ml-2">({formatDuration(result.normalMinutes)})</span></span>
                  <span className="font-medium">{result.normalPay?.toFixed(2)} €</span>
                </div>
                
                {result.overtime50Minutes > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-slate-300">Vuorokautinen ylityö 50 % <span className="text-slate-500 text-sm ml-2">({formatDuration(result.overtime50Minutes)})</span></span>
                    <span className="font-medium text-amber-300">{result.overtime50Pay?.toFixed(2)} €</span>
                  </div>
                )}
                
                {result.overtime100Minutes > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-slate-300">Vuorokautinen ylityö 100 % <span className="text-slate-500 text-sm ml-2">({formatDuration(result.overtime100Minutes)})</span></span>
                    <span className="font-medium text-orange-400">{result.overtime100Pay?.toFixed(2)} €</span>
                  </div>
                )}

                {result.eveningMinutes > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-slate-300">Iltalisä ({eveningBonus}%) <span className="text-slate-500 text-sm ml-2">({formatDuration(result.eveningMinutes)})</span></span>
                    <span className="font-medium text-indigo-300">{result.eveningPay?.toFixed(2)} €</span>
                  </div>
                )}

                {result.nightMinutes > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-slate-300">Yölisä ({nightBonus}%) <span className="text-slate-500 text-sm ml-2">({formatDuration(result.nightMinutes)})</span></span>
                    <span className="font-medium text-purple-300">{result.nightPay?.toFixed(2)} €</span>
                  </div>
                )}

                {result.sundayMinutes > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-slate-300">Sunnuntaityölisä ({sundayBonus}%) <span className="text-slate-500 text-sm ml-2">({formatDuration(result.sundayMinutes)})</span></span>
                    <span className="font-medium text-pink-300">{result.sundayPay?.toFixed(2)} €</span>
                  </div>
                )}

                {result.saturdayMinutes > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-slate-300">Lauantailisä (10%) <span className="text-slate-500 text-sm ml-2">({formatDuration(result.saturdayMinutes)})</span></span>
                    <span className="font-medium text-teal-300">{result.saturdayPay?.toFixed(2)} €</span>
                  </div>
                )}
                
              </div>

              <div className="flex justify-between items-center py-4 mt-4 bg-slate-900/80 rounded-xl px-5 border border-slate-700">
                <span className="text-lg font-bold text-slate-200">Arvioitu palkka yhteensä</span>
                <span className="text-2xl font-black text-emerald-400">{result.totalPay?.toFixed(2)} €</span>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button 
                  onClick={handleSaveShift}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-medium rounded-xl transition flex items-center justify-center space-x-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>Tallenna Vuoro</span>
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      {activeTab === "shifts" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-semibold text-slate-200">Tallennetut vuorot ({savedShifts.length})</h2>
               <button onClick={fetchShifts} className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400">
                 <Clock size={20} />
               </button>
             </div>
             
             {savedShifts.length === 0 ? (
               <div className="text-center py-10">
                 <p className="text-slate-500 italic mb-4">Ei vielä tallennettuja vuoroja.</p>
                 <button onClick={() => setActiveTab("calculator")} className="text-blue-400 hover:underline">Lisää ensimmäinen vuoro tästä</button>
               </div>
             ) : (
               <div className="space-y-4">
                 {savedShifts.map((shift) => (
                   <div key={shift.id} className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl flex justify-between items-center group hover:border-slate-500 transition shadow-sm">
                     <div className="space-y-1">
                       <div className="text-white font-semibold">
                         {format(new Date(shift.date), "dd.MM.yyyy")}
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
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}

    </div>
  );
}

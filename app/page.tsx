"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { calculateSalary, CalculationResult } from "../utils/calculator";
import { Settings, Clock, Calculator, List, Save, User as UserIcon, Trash2, LogOut, Loader2, Calendar, Info, BookOpen, ShieldCheck, Scale, History } from "lucide-react";
import { isPublicHoliday } from "../utils/holidays";
import { supabase } from "../utils/supabase";
import { Session } from "@supabase/supabase-js";
import AuthModal from "./AuthModal";

interface Shift {
  id: string;
  date: string;
  start_input: string;
  end_input: string;
  break_start_str?: string;
  break_end_str?: string;
  base_wage?: string;
  user_id: string;
  [key: string]: unknown; // Allow for extra DB fields if needed
}

interface AnalyzedShift extends Shift {
  calc: CalculationResult;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"calculator" | "shifts" | "info">("calculator");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  
  // Settings
  const [userName, setUserName] = useState("");
  const [baseWage, setBaseWage] = useState("16.50");
  const [ktaWage, setKtaWage] = useState("");
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
  const [extraBreaks, setExtraBreaks] = useState<{start: string, end: string}[]>([]);

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [savedShifts, setSavedShifts] = useState<Shift[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load local settings on mount
    const savedWage = localStorage.getItem("base-wage") || "16.50";
    setBaseWage(savedWage);
    setKtaWage(localStorage.getItem("kta-wage") || "");
    setUserName(localStorage.getItem("user-name") || "");
    setExperience(localStorage.getItem("experience") || "default");
    setEveningBonus(localStorage.getItem("evening-bonus") || "15");
    setNightBonus(localStorage.getItem("night-bonus") || "20");
    setSundayBonus(localStorage.getItem("sunday-bonus") || "100");

    // Auth session
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) {
          fetchShifts();
          fetchProfile(session.user.id);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) {
          fetchShifts();
          fetchProfile(session.user.id);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();
      
      if (data && data.full_name) {
        setUserName(data.full_name);
        localStorage.setItem("user-name", data.full_name);
      } else if (error) {
        console.warn("Profile not found or error:", error.message);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

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
      const allBreakStarts = [breakStart, ...extraBreaks.map(eb => eb.start)].filter(Boolean).join("|");
      const allBreakEnds = [breakEnd, ...extraBreaks.map(eb => eb.end)].filter(Boolean).join("|");

      let { error } = await supabase.from("shifts").insert({
        user_id: session.user.id,
        date: new Date(startInput).toISOString(),
        start_input: startInput,
        end_input: endInput,
        break_start_str: allBreakStarts,
        break_end_str: allBreakEnds,
        total_minutes: result.totalMinutes,
        paid_minutes: result.paidMinutes,
        waiting_minutes: result.waitingMinutes,
        waiting_pay: result.waitingPay,
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

      // Jos virhe johtuu puuttuvista sarakkeista, yritä uudelleen ilman niitä
      if (error && (error.message.includes("waiting_minutes") || error.message.includes("waiting_pay"))) {
        console.warn("Missing waiting columns, retrying without them...");
        const { error: retryError } = await supabase.from("shifts").insert({
          user_id: session.user.id,
          date: new Date(startInput).toISOString(),
          start_input: startInput,
          end_input: endInput,
          break_start_str: allBreakStarts,
          break_end_str: allBreakEnds,
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
        error = retryError;
      }

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

  const saveSettings = async (newWage?: string, newExp?: string, newName?: string, newKta?: string) => {
    const finalName = newName !== undefined ? newName : userName;
    const finalKta = newKta !== undefined ? newKta : ktaWage;
    localStorage.setItem("base-wage", newWage || baseWage);
    localStorage.setItem("kta-wage", finalKta);
    localStorage.setItem("user-name", finalName);
    localStorage.setItem("experience", newExp || experience);
    localStorage.setItem("evening-bonus", eveningBonus);
    localStorage.setItem("night-bonus", nightBonus);
    localStorage.setItem("sunday-bonus", sundayBonus);

    // Sync name to Supabase profile if logged in
    if (session && supabase && newName !== undefined) {
      try {
        await supabase.from("profiles").upsert({
          id: session.user.id,
          full_name: finalName,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error syncing profile to Supabase:", err);
      }
    }
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

    const breaks: { start: Date; end: Date }[] = [];
    
    const parseBreak = (bStartStr: string, bEndStr: string) => {
      if (!bStartStr || !bEndStr) return null;
      const bStart = new Date(startTime);
      const [sh, sm] = bStartStr.split(":").map(Number);
      bStart.setHours(sh, sm, 0, 0);
      if (bStart < startTime) bStart.setDate(bStart.getDate() + 1);

      const bEnd = new Date(bStart);
      const [eh, em] = bEndStr.split(":").map(Number);
      bEnd.setHours(eh, em, 0, 0);
      if (bEnd < bStart) bEnd.setDate(bEnd.getDate() + 1);
      return { start: bStart, end: bEnd };
    };

    const firstBrk = parseBreak(breakStart, breakEnd);
    if (firstBrk) breaks.push(firstBrk);

    extraBreaks.forEach(eb => {
      const brk = parseBreak(eb.start, eb.end);
      if (brk) breaks.push(brk);
    });

    saveSettings();

    const calcObj = calculateSalary({
      startTime,
      endTime,
      breaks,
      baseWage: parseFloat(baseWage) || 0,
      ktaWage: ktaWage ? parseFloat(ktaWage) : undefined
    });

    setResult(calcObj);
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  };

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-700">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">AKT Palkanlaskenta</h1>
          <p className="text-slate-400 mt-1">Kuljetusalan TES-pohjainen laskuri</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          {session ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-white leading-tight">{userName || session.user.email}</div>
                {userName && <div className="text-[10px] text-slate-500">{session.user.email}</div>}
              </div>
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
      <div className="flex space-x-1.5 sm:space-x-2 mb-6">
        <button 
          onClick={() => setActiveTab("calculator")}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-1 sm:space-x-2 ${activeTab === "calculator" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`}
        >
          <Calculator size={18} />
          <span>Laskuri</span>
        </button>
        <button 
          onClick={() => setActiveTab("shifts")}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-1 sm:space-x-2 ${activeTab === "shifts" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`}
        >
          <List size={18} />
          <span>Omat vuorot</span>
        </button>
        <button 
          onClick={() => setActiveTab("info")}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-1 sm:space-x-2 ${activeTab === "info" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`}
        >
          <Info size={18} />
          <span>Ohjeet</span>
        </button>
      </div>

      {activeTab === "calculator" && (
        <div className="space-y-6">
          
          <div className="bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-700/50 shadow-xl">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center space-x-2 text-slate-200">
              <Settings className="text-blue-400" />
              <span>Asetukset (AUT 2025-2026)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-1">Käyttäjän nimi</label>
                <input 
                  type="text" 
                  value={userName} 
                  onChange={(e) => { setUserName(e.target.value); saveSettings(undefined, undefined, e.target.value); }} 
                  placeholder="Esim. Nasratollah Rezai"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" 
                />
              </div>
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
                <input type="number" step="0.01" value={baseWage} onChange={(e) => { setBaseWage(e.target.value); setExperience("default"); saveSettings(e.target.value); }} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">KTA (€/h) <span className="text-[10px] text-slate-500 font-normal">(Lisiä varten)</span></label>
                <input type="number" step="0.01" value={ktaWage} onChange={(e) => { setKtaWage(e.target.value); saveSettings(undefined, undefined, undefined, e.target.value); }} placeholder={baseWage} className="w-full bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Sunnuntai/vapaapäivätyölisä (%)</label>
                <input type="number" value={sundayBonus} onChange={(e) => setSundayBonus(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
          <div className="bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-700/50 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2 text-slate-200">
              <Clock className="text-blue-400" />
              <span>Vuoron syöttö</span>
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Vuoron alku</label>
                <input type="datetime-local" value={startInput} onChange={(e) => setStartInput(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 sm:px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition [color-scheme:dark] min-w-0 box-border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Vuoron loppu</label>
                <input type="datetime-local" value={endInput} onChange={(e) => setEndInput(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 sm:px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition [color-scheme:dark] min-w-0 box-border" />
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Tauot (Yht. 1h palkaton)</h3>
                <button 
                  onClick={() => setExtraBreaks([...extraBreaks, { start: "", end: "" }])}
                  className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-lg text-blue-300 transition"
                >
                  + Lisää tauko
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Päätauko alkaa</label>
                    <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 sm:px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition [color-scheme:dark] min-w-0 box-border" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Päätauko päättyy</label>
                    <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 sm:px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition [color-scheme:dark] min-w-0 box-border" />
                  </div>
                </div>

                {extraBreaks.map((eb, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_40px] gap-4 items-end border-t border-slate-800/50 pt-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Tauko {idx + 2} alkaa</label>
                      <input 
                        type="time" 
                        value={eb.start} 
                        onChange={(e) => {
                          const newBreaks = [...extraBreaks];
                          newBreaks[idx].start = e.target.value;
                          setExtraBreaks(newBreaks);
                        }} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 sm:px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition [color-scheme:dark]" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Tauko {idx + 2} päättyy</label>
                      <input 
                        type="time" 
                        value={eb.end} 
                        onChange={(e) => {
                          const newBreaks = [...extraBreaks];
                          newBreaks[idx].end = e.target.value;
                          setExtraBreaks(newBreaks);
                        }} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 sm:px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition [color-scheme:dark]" 
                      />
                    </div>
                    <button 
                      onClick={() => setExtraBreaks(extraBreaks.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-500 hover:text-red-400 transition mb-0.5"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleCalculate} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition transform hover:-translate-y-0.5 mt-2">
              Laske Palkka
            </button>
          </div>

          {/* Results Card */}
          {result && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
              <h2 className="text-2xl font-bold mb-6 text-white border-b border-slate-700 pb-4">Laskelman tulos</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-700/50">
                  <div className="text-slate-400 text-sm mb-1">Bruttotyöaika</div>
                  <div className="text-xl font-semibold text-white">{formatDuration(result.totalMinutes)}</div>
                </div>
                <div className="bg-blue-950/30 rounded-xl p-4 border border-blue-900/50">
                  <div className="text-blue-300 text-sm mb-1">Palkallinen aika (sidonnaisuus)</div>
                  <div className="text-xl font-semibold text-blue-100">{formatDuration(result.paidMinutes + result.waitingMinutes)}</div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Palkan ja lisien erittely</h3>
                
                <div className="grid grid-cols-[1fr_repeat(3,80px)] sm:grid-cols-[1fr_repeat(3,100px)] gap-2 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-700 pb-2">
                  <span>Nimike</span>
                  <span className="text-right">Yksiköt</span>
                  <span className="text-right">A-hinta</span>
                  <span className="text-right">Yhteensä</span>
                </div>
                
                <div className="grid grid-cols-[1fr_repeat(3,80px)] sm:grid-cols-[1fr_repeat(3,100px)] gap-2 py-2 border-b border-slate-700/50 items-center">
                  <span className="text-slate-300 text-xs sm:text-sm">11000 Tuntityö</span>
                  <span className="text-right text-slate-400 text-xs sm:text-sm">{formatDuration(result.paidMinutes)}</span>
                  <span className="text-right text-slate-400 text-xs sm:text-sm">{parseFloat(baseWage).toFixed(2)}</span>
                  <span className="text-right font-medium text-white text-xs sm:text-sm">{result.normalPay?.toFixed(2)} €</span>
                </div>

                {result.waitingMinutes > 0 && (
                  <div className="grid grid-cols-[1fr_repeat(3,80px)] sm:grid-cols-[1fr_repeat(3,100px)] gap-2 py-2 border-b border-slate-700/50 items-center">
                    <span className="text-slate-300 text-xs sm:text-sm">40300 Odotusajan palkka</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{formatDuration(result.waitingMinutes)}</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{parseFloat(baseWage).toFixed(2)}</span>
                    <span className="text-right font-medium text-blue-300 text-xs sm:text-sm">{result.waitingPay?.toFixed(2)} €</span>
                  </div>
                )}

                {result.eveningMinutes > 0 && (
                  <div className="grid grid-cols-[1fr_repeat(3,80px)] sm:grid-cols-[1fr_repeat(3,100px)] gap-2 py-2 border-b border-slate-700/50 items-center">
                    <span className="text-slate-300 text-xs sm:text-sm">30020 Iltavuorolisä ({eveningBonus}%)</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{formatDuration(result.eveningMinutes)}</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{( (parseFloat(ktaWage) || parseFloat(baseWage)) * (parseFloat(eveningBonus) / 100) ).toFixed(2)}</span>
                    <span className="text-right font-medium text-indigo-300 text-xs sm:text-sm">{result.eveningPay?.toFixed(2)} €</span>
                  </div>
                )}

                {result.nightMinutes > 0 && (
                  <div className="grid grid-cols-[1fr_repeat(3,80px)] sm:grid-cols-[1fr_repeat(3,100px)] gap-2 py-2 border-b border-slate-700/50 items-center">
                    <span className="text-slate-300 text-xs sm:text-sm">30030 Yövuorolisä ({nightBonus}%)</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{formatDuration(result.nightMinutes)}</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{( (parseFloat(ktaWage) || parseFloat(baseWage)) * (parseFloat(nightBonus) / 100) ).toFixed(2)}</span>
                    <span className="text-right font-medium text-purple-300 text-xs sm:text-sm">{result.nightPay?.toFixed(2)} €</span>
                  </div>
                )}

                {result.sundayMinutes > 0 && (
                  <div className="grid grid-cols-[1fr_repeat(3,80px)] sm:grid-cols-[1fr_repeat(3,100px)] gap-2 py-2 border-b border-slate-700/50 items-center">
                    <span className="text-slate-300 text-xs sm:text-sm">20110 Sunnuntaitunnit ({sundayBonus}%)</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{formatDuration(result.sundayMinutes)}</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{( (parseFloat(ktaWage) || parseFloat(baseWage)) * (parseFloat(sundayBonus) / 100) ).toFixed(2)}</span>
                    <span className="text-right font-medium text-pink-300 text-xs sm:text-sm">{result.sundayPay?.toFixed(2)} €</span>
                  </div>
                )}

                {result.saturdayMinutes > 0 && (
                  <div className="grid grid-cols-[1fr_repeat(3,80px)] sm:grid-cols-[1fr_repeat(3,100px)] gap-2 py-2 border-b border-slate-700/50 items-center">
                    <span className="text-slate-300 text-xs sm:text-sm">30060 Lauantailisä (10%)</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{formatDuration(result.saturdayMinutes)}</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{( (parseFloat(ktaWage) || parseFloat(baseWage)) * 0.10 ).toFixed(2)}</span>
                    <span className="text-right font-medium text-teal-300 text-xs sm:text-sm">{result.saturdayPay?.toFixed(2)} €</span>
                  </div>
                )}
                
                {result.holidayMinutes > 0 && (
                  <div className="grid grid-cols-[1fr_repeat(3,80px)] sm:grid-cols-[1fr_repeat(3,100px)] gap-2 py-2 border-b border-slate-700/50 items-center">
                    <span className="text-slate-300 text-xs sm:text-sm">Arkipyhälisä (100%)</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{formatDuration(result.holidayMinutes)}</span>
                    <span className="text-right text-slate-400 text-xs sm:text-sm">{(parseFloat(ktaWage) || parseFloat(baseWage)).toFixed(2)}</span>
                    <span className="text-right font-medium text-red-300 text-xs sm:text-sm">{result.holidayPay?.toFixed(2)} €</span>
                  </div>
                )}
                
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 mt-4 bg-slate-900/80 rounded-xl px-4 sm:px-5 border border-slate-700 gap-2">
                <span className="text-sm sm:text-lg font-bold text-slate-200 uppercase sm:normal-case tracking-wider sm:tracking-normal">Arvioitu palkka yhteensä</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400">{result.totalPay?.toFixed(2)} €</span>
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
          <div className="bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-700/50 shadow-xl">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-lg sm:text-xl font-semibold text-slate-200">Tallennetut vuorot ({savedShifts.length})</h2>
               <button onClick={fetchShifts} className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400">
                 <Clock size={20} />
               </button>
             </div>
             
             {savedShifts.length === 0 ? (
               <div className="text-center py-10">
                 <p className="text-slate-500 italic mb-4">Ei vielä tallennettuja vuoroja.</p>
                 <button onClick={() => setActiveTab("calculator")} className="text-blue-400 hover:underline">Lisää ensimmäinen vuoro tästä</button>
               </div>
             ) : (() => {
               // Ryhmittele vuorot 2 viikon jaksoihin
               const sorted = [...savedShifts].sort((a: Shift, b: Shift) => new Date(a.date).getTime() - new Date(b.date).getTime());
               const periods: Record<string, typeof savedShifts> = {};
               
               sorted.forEach((shift) => {
                 const d = new Date(shift.date);
                 // Laske jakson alku: parillinen viikko alkaa maanantaista
                 const dayOfWeek = d.getDay() || 7; // Ma=1...Su=7
                 const monday = new Date(d);
                 monday.setDate(d.getDate() - (dayOfWeek - 1));
                 // Laske viikon numero
                 const startOfYear = new Date(monday.getFullYear(), 0, 1);
                 const weekNum = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
                 // Parillinen viikko (esim. 16.2.2026 Viikko 8) aloittaa jakson
                 const periodWeek = weekNum % 2 === 0 ? weekNum : weekNum - 1;
                 const periodKey = `${monday.getFullYear()}-W${periodWeek}`;
                 
                 if (!periods[periodKey]) periods[periodKey] = [];
                 periods[periodKey].push(shift);
               });

               return (
                 <div className="space-y-6">
                   {Object.entries(periods).map(([periodKey, shifts]) => {
                     const periodShifts = shifts.sort((a: Shift, b: Shift) => new Date(a.date).getTime() - new Date(b.date).getTime());
                     const firstDate = new Date(periodShifts[0].date);
                                      const analyzedPeriodShifts = periodShifts.map(shift => {
                        const sTime = new Date(shift.start_input);
                        const eTime = new Date(shift.end_input);
                        const bList: { start: Date; end: Date }[] = [];
                        
                        // Parse multiple breaks from pipe-separated strings
                        if (shift.break_start_str && shift.break_end_str) {
                          const starts = shift.break_start_str.split("|");
                          const ends = shift.break_end_str.split("|");
                          
                          const parseB = (bss: string, bes: string) => {
                            if (!bss || !bes) return null;
                            const bStart = new Date(sTime);
                            const [sh, sm] = bss.split(":").map(Number);
                            bStart.setHours(sh, sm, 0, 0);
                            if (bStart < sTime) bStart.setDate(bStart.getDate() + 1);
                            const bEnd = new Date(bStart);
                            const [eh, em] = bes.split(":").map(Number);
                            bEnd.setHours(eh, em, 0, 0);
                            if (bEnd < bStart) bEnd.setDate(bEnd.getDate() + 1);
                            return { start: bStart, end: bEnd };
                          };
                          
                          starts.forEach((s: string, i: number) => {
                            const b = parseB(s, ends[i]);
                            if (b) bList.push(b);
                          });
                        }
                        
                        // Parse extra breaks if stored (currently only first one is saved to DB columns)
                        // If we had a JSON column we'd use it here.
                        
                        return {
                          ...shift,
                          calc: calculateSalary({
                            startTime: sTime,
                            endTime: eTime,
                            breaks: bList,
                            baseWage: Number(shift.base_wage) || parseFloat(baseWage),
                            ktaWage: ktaWage ? parseFloat(ktaWage) : (Number(shift.kta_wage) || undefined)
                          })
                        };
                      });

                      const totalPay = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + (s.calc.totalPay || 0), 0);
                      const totalMinutes = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + s.calc.paidMinutes, 0);
                      
                      // Breakdown for period
                      const periodNormalPay = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + (s.calc.normalPay || 0), 0);
                      const periodWaitingPay = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + (s.calc.waitingPay || 0), 0);
                      const periodEveningPay = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + (s.calc.eveningPay || 0), 0);
                      const periodNightPay = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + (s.calc.nightPay || 0), 0);
                      const periodSaturdayPay = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + (s.calc.saturdayPay || 0), 0);
                      const periodSundayPay = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + (s.calc.sundayPay || 0), 0);
                      const periodHolidayPay = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + (s.calc.holidayPay || 0), 0);

                      const periodNormalMinutes = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + s.calc.paidMinutes, 0);
                      const periodWaitingMinutes = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + s.calc.waitingMinutes, 0);
                      const periodEveningMinutes = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + s.calc.eveningMinutes, 0);
                      const periodNightMinutes = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + s.calc.nightMinutes, 0);
                      const periodSaturdayMinutes = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + s.calc.saturdayMinutes, 0);
                      const periodSundayMinutes = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + s.calc.sundayMinutes, 0);
                      const periodHolidayMinutes = analyzedPeriodShifts.reduce((sum: number, s: AnalyzedShift) => sum + s.calc.holidayMinutes, 0);

                      const holidayShifts = analyzedPeriodShifts.filter((s: AnalyzedShift) => isPublicHoliday(new Date(s.date)));
                     
                     // Jaksotyöylityö-logiikka (80h / 2 viikkoa)
                     const totalHours = totalMinutes / 60;
                     
                     // Jakson ylityörajat: 80h asti normaali, 80-92h 50%, yli 92h 100%
                     const periodOvertime50 = Math.max(0, Math.min(totalHours, 92) - 80);
                     const periodOvertime100 = Math.max(0, totalHours - 92);
                     
                     // Lasketaan ylityölisän arvo (50% ja 100% lisäosan osuus)
                     const ktaForOt = parseFloat(ktaWage) || parseFloat(baseWage);
                     const periodOvertimePay = (periodOvertime50 * (ktaForOt * 0.5)) + (periodOvertime100 * (ktaForOt * 1.0));

                     const lastDate = new Date(periodShifts[periodShifts.length - 1].date);

                     return (
                       <div key={periodKey} className="space-y-3">
                         {/* Jakson otsikko */}
                         <div className="flex flex-col bg-slate-900/80 rounded-xl p-4 border border-slate-600/30">
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
                           </div>
                           
                           {/* Jaksotyöylityö-ilmoitus */}
                           {(periodOvertime50 > 0 || periodOvertime100 > 0) && (
                             <div className="mt-2 py-2 px-3 bg-amber-950/20 border border-amber-900/30 rounded-lg flex items-center justify-between text-xs">
                               <span className="text-amber-200 flex items-center gap-2">
                                 <Settings size={14} />
                                 Jakson ylityö (vasta 80h jälkeen): {periodOvertime50 > 0 && `${periodOvertime50.toFixed(1)}h (50%)`} {periodOvertime100 > 0 && `${periodOvertime100.toFixed(1)}h (100%)`}
                               </span>
                               <span className="text-amber-300 font-bold">+ {periodOvertimePay.toFixed(2)} €</span>
                             </div>
                           )}

                           {/* Jakson erittely */}
                           <div className="mt-2 space-y-1 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                            <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 text-[10px] text-slate-500 uppercase font-bold mb-1 border-b border-slate-700/30 pb-1">
                              <span>Nimike</span>
                              <span className="text-right">Yksiköt</span>
                              <span className="text-right">A-hinta</span>
                              <span className="text-right">Euroa</span>
                            </div>

                             <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 text-xs text-slate-400">
                               <span>11000 Tuntityö</span>
                               <span className="text-right">{formatDuration(periodNormalMinutes)}</span>
                               <span className="text-right">{parseFloat(baseWage).toFixed(2)}</span>
                               <span className="text-right font-medium">{periodNormalPay.toFixed(2)}</span>
                             </div>
                             
                             {periodWaitingMinutes > 0 && (
                               <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 text-xs text-blue-400/80">
                                 <span>40300 Odotusajan palkka</span>
                                 <span className="text-right">{formatDuration(periodWaitingMinutes)}</span>
                                 <span className="text-right">{parseFloat(baseWage).toFixed(2)}</span>
                                 <span className="text-right font-medium">{periodWaitingPay.toFixed(2)}</span>
                               </div>
                             )}

                              {periodEveningPay > 0 && (
                                <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 text-xs text-indigo-400/80">
                                  <span>30020 Iltavuorolisä</span>
                                  <span className="text-right">{formatDuration(periodEveningMinutes)}</span>
                                  <span className="text-right">{( (parseFloat(ktaWage) || parseFloat(baseWage)) * (parseFloat(eveningBonus)/100) ).toFixed(2)}</span>
                                  <span className="text-right font-medium">{periodEveningPay.toFixed(2)}</span>
                                </div>
                              )}
                              {periodNightPay > 0 && (
                                <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 text-xs text-purple-400/80">
                                  <span>30030 Yövuorolisä</span>
                                  <span className="text-right">{formatDuration(periodNightMinutes)}</span>
                                  <span className="text-right">{( (parseFloat(ktaWage) || parseFloat(baseWage)) * (parseFloat(nightBonus)/100) ).toFixed(2)}</span>
                                  <span className="text-right font-medium">{periodNightPay.toFixed(2)}</span>
                                </div>
                              )}
                              {periodSaturdayPay > 0 && (
                                <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 text-xs text-teal-400/80">
                                  <span>30060 Lauantailisä</span>
                                  <span className="text-right">{formatDuration(periodSaturdayMinutes)}</span>
                                  <span className="text-right">{( (parseFloat(ktaWage) || parseFloat(baseWage)) * 0.10 ).toFixed(2)}</span>
                                  <span className="text-right font-medium">{periodSaturdayPay.toFixed(2)}</span>
                                </div>
                              )}
                              {periodSundayPay > 0 && (
                                <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 text-xs text-pink-400/80">
                                  <span>20110 Sunnuntaitunnit</span>
                                  <span className="text-right">{formatDuration(periodSundayMinutes)}</span>
                                  <span className="text-right">{( (parseFloat(ktaWage) || parseFloat(baseWage)) * (parseFloat(sundayBonus)/100) ).toFixed(2)}</span>
                                  <span className="text-right font-medium">{periodSundayPay.toFixed(2)}</span>
                                </div>
                              )}
                             {periodHolidayPay > 0 && (
                               <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 text-xs text-red-400/80">
                                 <span>Arkipyhälisä</span>
                                 <span className="text-right">{formatDuration(periodHolidayMinutes)}</span>
                                 <span className="text-right">{(parseFloat(ktaWage) || parseFloat(baseWage)).toFixed(2)}</span>
                                 <span className="text-right font-medium">{periodHolidayPay.toFixed(2)}</span>
                               </div>
                             )}
                             {periodOvertimePay > 0 && (
                               <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 text-xs text-amber-400/80 pt-1 border-t border-slate-700/50">
                                 <span>Ylityölisät (50% & 100%)</span>
                                 <span className="text-right">-</span>
                                 <span className="text-right">-</span>
                                 <span className="text-right font-medium">{periodOvertimePay.toFixed(2)}</span>
                               </div>
                             )}
                           </div>
                         </div>
                         
                         {/* Jakson vuorot */}
                         <div className="space-y-2 ml-2">
                           {periodShifts.map((shift) => {
                             const shiftDate = new Date(shift.date);
                             const isHoliday = isPublicHoliday(shiftDate);
                             return (
                               <div key={shift.id} className={`bg-slate-900/50 border p-4 rounded-xl flex justify-between items-center group hover:border-slate-500 transition shadow-sm ${isHoliday ? 'border-red-800/50' : 'border-slate-700'}`}>
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
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               );
              })()}
          </div>
        </div>
      )}

      {activeTab === "info" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
             <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
               <BookOpen className="text-blue-400" />
               <span>AKT Palkanlaskuri - Käyttöohje</span>
             </h2>

             <div className="space-y-8 text-slate-300">
               <section>
                 <h3 className="text-lg font-semibold text-blue-300 mb-3 border-b border-slate-700 pb-2 flex items-center gap-2">
                   <Settings size={18} /> 1. Perusasetukset
                 </h3>
                 <p className="text-sm leading-relaxed">
                   Ennen vuorojen syöttämistä, varmista että asetukset ovat oikein. Valitse <strong>Palveluvuodet</strong> TES-taulukosta, jolloin perustuntipalkka päivittyy automaattisesti. Muista valita <strong>HSL-ajot</strong>, jos ajat Helsingin seudun liikenteen sopimusajoja.
                 </p>
               </section>

               <section>
                 <h3 className="text-lg font-semibold text-emerald-300 mb-3 border-b border-slate-700 pb-2 flex items-center gap-2">
                   <ShieldCheck size={18} /> 2. Arkipyhät (100% lisä)
                 </h3>
                 <p className="text-sm leading-relaxed">
                   Sovellus tunnistaa automaattisesti Suomen viralliset arkipyhät (esim. joulu, juhannus, pääsiäinen). Arkipyhänä tehty työ oikeuttaa <strong>100% lisään</strong>. Sovellus estää automaattisesti &quot;tuplabonukset&quot;, jos pyhä sattuu sunnuntaille.
                 </p>
               </section>

               <section>
                 <h3 className="text-lg font-semibold text-amber-300 mb-3 border-b border-slate-700 pb-2 flex items-center gap-2">
                   <Scale size={18} /> 3. Jaksotyö (80h sääntö)
                 </h3>
                 <div className="bg-slate-900/50 p-4 rounded-xl border border-amber-900/20 text-sm">
                    <p className="mb-2 font-medium text-amber-200">AKT Jaksotyön periaate:</p>
                    <ul className="list-disc ml-5 space-y-1 text-slate-400">
                      <li>Tunnit tasaantuvat 14 vrk jakson sisällä.</li>
                      <li>Päivittäistä ylityötä (esim. 8h ylitys) ei makseta erikseen.</li>
                      <li>Ylityökorvaukset alkavat vasta kun <strong>80 tuntia</strong> ylittyy jakson aikana.</li>
                      <li>80-92h = +50% | yli 92h = +100%</li>
                    </ul>
                 </div>
               </section>

               <section>
                 <h3 className="text-lg font-semibold text-purple-300 mb-3 border-b border-slate-700 pb-2 flex items-center gap-2">
                   <History size={18} /> 4. Palkkajaksot
                 </h3>
                 <p className="text-sm leading-relaxed">
                   Sovellus jakaa vuorot 14 vuorokauden jaksoihin, jotka alkavat <strong>parillisista viikoista</strong> (esim. viikko 8, 10, 12...). Voit tarkastella jakson kokonaissaldoa &quot;Omat vuorot&quot; -välilehdeltä.
                 </p>
               </section>
             </div>

             <div className="mt-8 pt-6 border-t border-slate-700 text-center">
               <p className="text-xs text-slate-500 italic">
                 Tämä laskuri on suuntaa-antava apuväline. Tarkista lopullinen palkkasi virallisesta palkkalaskelmasta.
               </p>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

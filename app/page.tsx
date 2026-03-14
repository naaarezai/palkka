"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { calculateSalary, CalculationResult } from "../utils/calculator";
import { Settings, Clock, Calculator, List, Save, User as UserIcon, Trash2 } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"calculator" | "shifts">("calculator");
  
  // Settings
  const [baseWage, setBaseWage] = useState("16.50");
  const [eveningBonus, setEveningBonus] = useState("15");
  const [nightBonus, setNightBonus] = useState("20");
  const [sundayBonus, setSundayBonus] = useState("100");

  // Inputs
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");

  const [result, setResult] = useState<CalculationResult | null>(null);

  useEffect(() => {
    // Load local settings on mount
    setBaseWage(localStorage.getItem("base-wage") || "16.50");
    setEveningBonus(localStorage.getItem("evening-bonus") || "15");
    setNightBonus(localStorage.getItem("night-bonus") || "20");
    setSundayBonus(localStorage.getItem("sunday-bonus") || "100");
  }, []);

  const saveSettings = () => {
    localStorage.setItem("base-wage", baseWage);
    localStorage.setItem("evening-bonus", eveningBonus);
    localStorage.setItem("night-bonus", nightBonus);
    localStorage.setItem("sunday-bonus", sundayBonus);
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
        <div className="mt-4 sm:mt-0">
          <button className="flex items-center space-x-2 text-sm bg-slate-700 hover:bg-slate-600 transition px-4 py-2 rounded-lg text-slate-200">
            <UserIcon size={16} />
            <span>Kirjaudu Pilveen</span>
          </button>
        </div>
      </header>

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
          
          {/* Settings Card */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2 text-slate-200">
              <Settings className="text-blue-400" />
              <span>Asetukset (Pysyvät tiedot)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Perustuntipalkka / Taulukkopalkka (€/h)</label>
                <input type="number" step="0.01" value={baseWage} onChange={(e) => setBaseWage(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Sunnuntai/Vapaapäivätyölisä (%)</label>
                <input type="number" value={sundayBonus} onChange={(e) => setSundayBonus(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Iltalisä (%) - klo 18-22</label>
                <input type="number" value={eveningBonus} onChange={(e) => setEveningBonus(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Yölisä (%) - klo 22-06</label>
                <input type="number" value={nightBonus} onChange={(e) => setNightBonus(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
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
                
              </div>

              <div className="flex justify-between items-center py-4 mt-4 bg-slate-900/80 rounded-xl px-5 border border-slate-700">
                <span className="text-lg font-bold text-slate-200">Arvioitu palkka yhteensä</span>
                <span className="text-2xl font-black text-emerald-400">{result.totalPay?.toFixed(2)} €</span>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition flex items-center justify-center space-x-2">
                  <Save size={18} />
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
             <h2 className="text-xl font-semibold mb-4 text-slate-200">Tallennetut vuorot</h2>
             <p className="text-slate-400 text-sm">Omat vuorot näkyvät tässä (Keskeneräinen).</p>
          </div>
        </div>
      )}

    </div>
  );
}

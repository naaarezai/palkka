"use client";

import { useState } from "react";
import { supabase } from "../utils/supabase";
import { X, Mail, Lock, UserPlus, LogIn, Loader2 } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!supabase) {
      setError("Supabasea ei ole määritetty. Lisää avaimet .env.local tiedostoon.");
      setLoading(false);
      return;
    }

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage("Rekisteröityminen onnistui! Tarkista sähköpostivahvistus.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tapahtui virhe";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              {isRegister ? <UserPlus className="text-blue-400" /> : <LogIn className="text-blue-400" />}
              <span>{isRegister ? "Luo tili" : "Kirjaudu sisään"}</span>
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Sähköposti</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="esimerkki@mail.fi"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Salasana</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-emerald-900/30 border border-emerald-800 text-emerald-300 text-sm p-3 rounded-lg">
                {message}
              </div>
            )}

            <button 
              disabled={loading}
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/30 transition flex items-center justify-center space-x-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (isRegister ? "Luo tili" : "Kirjaudu sisään")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-slate-400 hover:text-blue-400 transition"
            >
              {isRegister ? "Onko sinulla jo tili? Kirjaudu" : "Eikö sinulla ole tiliä? Rekisteröidy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

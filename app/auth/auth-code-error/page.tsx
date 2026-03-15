export default function AuthCodeError() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-center">
      <div className="max-w-md bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-4">Hups! Kirjautumislinkki ei toiminut</h1>
        <p className="text-slate-400 mb-6">
          Vaikuttaa siltä, että kirjautumislinkki on vanhentunut tai se on jo käytetty. 
          Kokeile kirjautua uudelleen sähköpostilla ja salasanalla etusivulta.
        </p>
        <a 
          href="/" 
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition"
        >
          Palaa Etusivulle
        </a>
      </div>
    </div>
  );
}

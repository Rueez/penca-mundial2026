import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Play } from './pages/Play';
import { Ranking } from './pages/Ranking';
import { Participants } from './pages/Participants';
import { Admin } from './pages/Admin';
import { Trophy, Menu, X, Play as PlayIcon } from 'lucide-react';
import { isRegistrationClosed } from './utils/timezone';

const Navigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isClosed = isRegistrationClosed();

  const isLinkActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="sticky top-0 z-40 bg-slate-950/75 backdrop-blur-md border-b border-slate-900/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 text-slate-100 hover:text-white font-extrabold text-lg tracking-tight">
              <Trophy className="h-6 w-6 text-amber-400" />
              <span>Penca <span className="text-amber-400">Mundial 2026</span></span>
            </Link>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm font-semibold transition ${
                isLinkActive('/') ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/ranking"
              className={`text-sm font-semibold transition ${
                isLinkActive('/ranking') ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ranking
            </Link>
            <Link
              to="/participantes"
              className={`text-sm font-semibold transition ${
                isLinkActive('/participantes') ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pronósticos
            </Link>
            <Link
              to="/admin"
              className={`text-sm font-semibold transition ${
                isLinkActive('/admin') ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Administrar
            </Link>
            
            {!isClosed && (
              <Link
                to="/jugar"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-md shadow-amber-400/10"
              >
                <PlayIcon className="h-3 w-3 fill-current animate-pulse" /> Participar
              </Link>
            )}
          </div>

          {/* Hamburger button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 focus:outline-none transition"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-b border-slate-900 bg-slate-950/95 backdrop-blur-lg px-2 pt-2 pb-4 space-y-1">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className={`block px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              isLinkActive('/') ? 'bg-slate-900 text-amber-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-100'
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/ranking"
            onClick={() => setIsOpen(false)}
            className={`block px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              isLinkActive('/ranking') ? 'bg-slate-900 text-amber-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-100'
            }`}
          >
            Ranking
          </Link>
          <Link
            to="/participantes"
            onClick={() => setIsOpen(false)}
            className={`block px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              isLinkActive('/participantes') ? 'bg-slate-900 text-amber-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-100'
            }`}
          >
            Pronósticos
          </Link>
          <Link
            to="/admin"
            onClick={() => setIsOpen(false)}
            className={`block px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              isLinkActive('/admin') ? 'bg-slate-900 text-amber-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-100'
            }`}
          >
            Administrar
          </Link>
          
          {!isClosed && (
            <Link
              to="/jugar"
              onClick={() => setIsOpen(false)}
              className="block text-center mx-4 mt-4 py-2.5 font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition"
            >
              Participar
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navigation />
        
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jugar" element={<Play />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/participantes" element={<Participants />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
        
        <footer className="bg-slate-950 border-t border-slate-900/60 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4">
            <p className="font-semibold text-slate-500">
              Penca Mundial 2026 &copy; {new Date().getFullYear()} - Competencia privada entre amigos
            </p>
            <p className="text-slate-650 mt-1">
              Todos los horarios se muestran convertidos a la hora oficial de Uruguay (GMT-3).
            </p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;

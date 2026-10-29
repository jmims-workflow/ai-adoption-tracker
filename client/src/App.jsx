import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import { ViewerContext } from './viewer.js';
import Overview from './pages/Overview.jsx';
import Pulse from './pages/Pulse.jsx';
import MyImpact from './pages/MyImpact.jsx';
import Import from './pages/Import.jsx';

const VIEWER_KEY = 'northstar.viewerId';

function readViewer() {
  try {
    return Number(localStorage.getItem(VIEWER_KEY)) || 1;
  } catch {
    return 1;
  }
}

function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <NavLink to="/" className="brand" aria-label="AI Adoption and Impact Tracker, home">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#0E6B62" />
            <path d="M8 22 L14 15 L18 18 L24 10" fill="none" stroke="#F4F5F2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="brand-text">
            <span className="brand-company">Northstar Systems</span>
            <span className="brand-name">AI Adoption &amp; Impact</span>
          </span>
        </NavLink>
        <span className="badge" title="All people and numbers in this app are fictional.">
          Demo data
        </span>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/pulse">Weekly pulse</NavLink>
          <NavLink to="/me">My AI impact</NavLink>
          <NavLink to="/import">Import</NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  const [viewerId, setViewerIdState] = useState(readViewer);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    api.get('/employees').then((d) => setEmployees(d.employees)).catch(() => {});
  }, []);

  const setViewerId = (id) => {
    setViewerIdState(id);
    try {
      localStorage.setItem(VIEWER_KEY, String(id));
    } catch {
      // Storage can be unavailable (private mode); the choice still works for this visit.
    }
  };

  return (
    <ViewerContext.Provider value={{ viewerId, setViewerId, employees }}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/pulse" element={<Pulse />} />
          <Route path="/me" element={<MyImpact />} />
          <Route path="/import" element={<Import />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
      <footer className="site-footer">
        Northstar Systems is a fictional company. All names and numbers are demo data.
      </footer>
    </ViewerContext.Provider>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { DataContext, loadData, saveData, buildInitialState } from './data/sampleData';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Management from './pages/Management';
import Scheduling from './pages/Scheduling';
import ConflictGraph from './pages/ConflictGraph';
import ConflictResolver from './pages/ConflictResolver';
import Timetable from './pages/Timetable';
import Analytics from './pages/Analytics';
import StudentPortal from './pages/StudentPortal';
import MathematicalConcepts from './pages/MathematicalConcepts';
import AlgorithmPlayground from './pages/AlgorithmPlayground';
import Settings from './pages/Settings';

export default function App() {
  const [data, setRaw] = useState(loadData);
  const [toasts, setToasts] = useState([]);
  const [menu, setMenu] = useState(false);

  // Save every change to LocalStorage automatically
  useEffect(() => saveData(data), [data]);

  const setData = useCallback((fn) => setRaw((prev) => (typeof fn === 'function' ? fn(prev) : { ...prev, ...fn })), []);
  const notify = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const log = useCallback((text) => {
    setRaw((prev) => ({ ...prev, activities: [{ id: Date.now() + Math.random(), time: new Date().toISOString(), text }, ...prev.activities].slice(0, 30) }));
  }, []);
  const resetData = useCallback(() => {
    setRaw(buildInitialState());
    notify('Original sample dataset restored');
  }, [notify]);

  const value = useMemo(() => ({ data, setData, notify, log, resetData }), [data, setData, notify, log, resetData]);
  const toastIcon = { success: <CheckCircle2 size={18} className="text-green-600" />, error: <XCircle size={18} className="text-red-600" />, info: <Info size={18} className="text-blue-600" />, warning: <Info size={18} className="text-orange-500" /> };

  return (
    <DataContext.Provider value={value}>
      <div className="min-h-screen">
        <Sidebar open={menu} onClose={() => setMenu(false)} />
        <div className="lg:ml-64 print:ml-0">
          <Topbar onMenu={() => setMenu(true)} />
          <main className="p-4 sm:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/management" element={<Management />} />
              <Route path="/scheduling" element={<Scheduling />} />
              <Route path="/conflict-graph" element={<ConflictGraph />} />
              <Route path="/conflict-resolver" element={<ConflictResolver />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/student-portal" element={<StudentPortal />} />
              <Route path="/math" element={<MathematicalConcepts />} />
              <Route path="/playground" element={<AlgorithmPlayground />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
        <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 print:hidden">
          {toasts.map((t) => (
            <div key={t.id} className="card flex items-center gap-2.5 px-4 py-3 text-sm shadow-lg">{toastIcon[t.type] || toastIcon.info}{t.message}</div>
          ))}
        </div>
      </div>
    </DataContext.Provider>
  );
}

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';

const Dashboard = React.lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.Dashboard }))
);

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        <Navbar />

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <Suspense
            fallback={
              <div className="py-24 text-center text-slate-400 space-y-3">
                <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium">Đang tải dữ liệu Dashboard...</p>
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              {/* Fallback unknown routes to / */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>TinyURL Distributed System Practice • Architectural Pattern Demo</span>
            <div className="flex items-center space-x-4 text-slate-400">
              <span>Nginx Edge CDN</span>
              <span>•</span>
              <span>Fastify Multi-Instance</span>
              <span>•</span>
              <span>Kafka Event Broker</span>
              <span>•</span>
              <span>Redis Negative Cache</span>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

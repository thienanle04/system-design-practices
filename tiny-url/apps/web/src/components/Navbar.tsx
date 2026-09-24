import React from 'react';
import { NavLink } from 'react-router-dom';
import { Zap, Radio, LayoutDashboard, Link2 } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                TinyURL Distributed Platform
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Edge CDN • Load Balancer • KGS • Kafka KRaft • Redis • PostgreSQL
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <Link2 className="w-4 h-4" />
            <span>Trang chủ</span>
          </NavLink>

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-medium transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard Quản Lý</span>
          </NavLink>
        </nav>

        {/* Status Indicator */}
        <div className="hidden md:flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Radio className="w-3 h-3 mr-1.5 animate-pulse text-emerald-400" />
            Cluster Active
          </span>
        </div>
      </div>
    </header>
  );
};

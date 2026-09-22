import React, { useState, useEffect } from 'react';
import {
  Link,
  Copy,
  ExternalLink,
  Activity,
  Layers,
  Server,
  Zap,
  BarChart3,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Smartphone,
  Laptop
} from 'lucide-react';

interface CreateResponse {
  short_code: string;
  short_url: string;
  original_url: string;
  is_custom: boolean;
  expires_at: string | null;
  created_at: string;
  served_by: string;
}

interface AnalyticsData {
  short_code: string;
  original_url: string;
  created_at: string;
  expires_at: string | null;
  total_clicks: number;
  daily_clicks: { date: string; clicks: number }[];
  browsers: { name: string; count: number }[];
  os: { name: string; count: number }[];
  devices: { name: string; count: number }[];
  recent_clicks: {
    clicked_at: string;
    browser: string | null;
    os: string | null;
    device: string | null;
    ip_address: string | null;
    referer: string | null;
  }[];
}

interface DiagnosticResult {
  status: number;
  cacheStatus: string;
  serverInstance: string;
  latencyMs: number;
  targetLocation?: string;
  timestamp: string;
}

export default function App() {
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Diagnostics
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);

  // Analytics
  const [analyticsCode, setAnalyticsCode] = useState('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const handleCreateUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload: any = { original_url: originalUrl };
      if (customAlias.trim()) payload.custom_alias = customAlias.trim();
      if (expiresInDays) payload.expires_in_days = parseInt(expiresInDays, 10);

      const res = await fetch('/api/v1/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create short URL');
      }

      setSuccessData(data);
      setAnalyticsCode(data.short_code);
      // Auto fetch analytics after creating
      fetchAnalytics(data.short_code);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runDiagnostic = async (code: string) => {
    setIsDiagnosing(true);
    const start = performance.now();
    try {
      // Send HEAD request to trigger Edge Cache & LB headers without following redirect
      const res = await fetch(`/${code}`, {
        method: 'HEAD',
        redirect: 'manual',
      });
      const end = performance.now();

      const result: DiagnosticResult = {
        status: res.status,
        cacheStatus: res.headers.get('x-cache-status') || 'N/A',
        serverInstance: res.headers.get('x-server-instance') || 'Edge Cached',
        latencyMs: Math.round(end - start),
        targetLocation: res.headers.get('location') || undefined,
        timestamp: new Date().toLocaleTimeString(),
      };

      setDiagnostics((prev) => [result, ...prev.slice(0, 9)]);
      // Refresh analytics after clicking redirect
      setTimeout(() => fetchAnalytics(code), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const fetchAnalytics = async (codeToFetch: string) => {
    if (!codeToFetch.trim()) return;
    setIsAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const res = await fetch(`/api/v1/urls/${codeToFetch.trim()}/analytics`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Analytics not found for this code');
      }
      setAnalyticsData(data);
    } catch (err: any) {
      setAnalyticsError(err.message);
      setAnalyticsData(null);
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                TinyURL Distributed Platform
              </h1>
              <p className="text-xs text-slate-400">Edge CDN • Load Balancer • KGS • Kafka KRaft • Redis • PostgreSQL</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Radio className="w-3 h-3 mr-1 animate-pulse" /> Local Cluster Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        {/* Architecture Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3">
            <Globe className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-xs text-slate-400">Edge Tier</div>
              <div className="text-sm font-semibold">Nginx CDN (30s)</div>
            </div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3">
            <Layers className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="text-xs text-slate-400">Load Balancer</div>
              <div className="text-sm font-semibold">Round-Robin (x2)</div>
            </div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-xs text-slate-400">Key Gen (KGS)</div>
              <div className="text-sm font-semibold">O(1) Redis Pool</div>
            </div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3">
            <Activity className="w-5 h-5 text-red-400" />
            <div>
              <div className="text-xs text-slate-400">Cache Layer</div>
              <div className="text-sm font-semibold">Redis Negative TTL</div>
            </div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3">
            <Radio className="w-5 h-5 text-violet-400" />
            <div>
              <div className="text-xs text-slate-400">Event Broker</div>
              <div className="text-sm font-semibold">Kafka KRaft</div>
            </div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3">
            <Server className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-xs text-slate-400">Primary DB</div>
              <div className="text-sm font-semibold">PostgreSQL 16</div>
            </div>
          </div>
        </div>

        {/* Section 1: Creator & Diagnostics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Creator Form */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center">
                <Link className="w-5 h-5 mr-2 text-indigo-400" /> Shorten New URL
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Generates a collision-free Short Code via KGS or assigns a Custom Alias.
              </p>
            </div>

            <form onSubmit={handleCreateUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Target Destination URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/very/long/article-or-documentation-page"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Custom Alias (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="my-cool-link"
                    value={customAlias}
                    onChange={(e) => setCustomAlias(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Alphanumeric, hyphens, underscores</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Expiration Window (Optional)
                  </label>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  >
                    <option value="">Never Expires (Permanent)</option>
                    <option value="1">1 Day</option>
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Allocating Key from KGS...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Generate Short URL</span>
                  </>
                )}
              </button>
            </form>

            {/* Result Box */}
            {successData && (
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" /> URL Shortened Successfully
                  </span>
                  <span className="text-xs text-slate-400">Served by: {successData.served_by}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={successData.short_url}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-indigo-500/40 text-indigo-200 font-mono text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy(successData.short_url)}
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Copy to clipboard"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={successData.short_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
                    title="Open link in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <span>Type: {successData.is_custom ? 'Custom Slug' : 'KGS Base62'}</span>
                  <span>{successData.expires_at ? `Expires: ${new Date(successData.expires_at).toLocaleDateString()}` : 'Never expires'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Edge CDN & Load Balancer Live Diagnostics */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-cyan-400" /> Edge & LB Diagnostics
                </h2>
                {successData && (
                  <button
                    onClick={() => runDiagnostic(successData.short_code)}
                    disabled={isDiagnosing}
                    className="px-3 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isDiagnosing ? 'animate-spin' : ''}`} />
                    <span>Test Request</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Sends test request to the Edge CDN. Notice <code className="text-cyan-300 font-mono">X-Cache-Status</code> (MISS on 1st, HIT on subsequent within 30s) and <code className="text-indigo-300 font-mono">X-Server-Instance</code>.
              </p>
            </div>

            {/* Diagnostic Logs */}
            <div className="flex-1 bg-slate-950 rounded-xl p-3 border border-slate-800/80 overflow-y-auto max-h-[320px] space-y-2 font-mono text-xs">
              {diagnostics.length === 0 ? (
                <div className="text-center py-12 text-slate-600">
                  No diagnostic requests sent yet.<br />Generate a URL and click "Test Request" above.
                </div>
              ) : (
                diagnostics.map((diag, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{diag.timestamp}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        diag.cacheStatus === 'HIT'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        CDN: {diag.cacheStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Server: {diag.serverInstance}</span>
                      <span className="text-cyan-400">{diag.latencyMs}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {successData && (
              <button
                onClick={() => runDiagnostic(successData.short_code)}
                disabled={isDiagnosing}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition flex items-center justify-center space-x-2"
              >
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>Simulate Traffic Click on /{successData.short_code}</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 2: Kafka Real-Time Analytics Dashboard */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-violet-400" /> Real-time Kafka Analytics Dashboard
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Ingested asynchronously via Kafka topic <code className="text-violet-300 font-mono">url-clicks</code> & micro-batched into PostgreSQL.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Enter Short Code..."
                value={analyticsCode}
                onChange={(e) => setAnalyticsCode(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
              />
              <button
                onClick={() => fetchAnalytics(analyticsCode)}
                disabled={isAnalyticsLoading || !analyticsCode.trim()}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isAnalyticsLoading ? 'animate-spin' : ''}`} />
                <span>Query</span>
              </button>
            </div>
          </div>

          {analyticsError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {analyticsError}
            </div>
          )}

          {analyticsData ? (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Total Verified Clicks</div>
                  <div className="text-3xl font-bold text-violet-400 mt-1">{analyticsData.total_clicks}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Ingested via Kafka topic url-clicks</div>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Short Code Target</div>
                  <div className="text-sm font-mono text-slate-200 truncate mt-2">{analyticsData.original_url}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Created {new Date(analyticsData.created_at).toLocaleDateString()}</div>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Edge Cache Status</div>
                  <div className="text-lg font-semibold text-emerald-400 mt-1">30s TTL Active</div>
                  <div className="text-[11px] text-slate-500 mt-1">Absorbing viral spike bursts</div>
                </div>
              </div>

              {/* Dimensions Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Browsers */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-slate-400 flex items-center">
                    <Globe className="w-4 h-4 mr-1.5 text-cyan-400" /> Top Browsers
                  </h3>
                  <div className="space-y-2">
                    {analyticsData.browsers.length === 0 ? (
                      <div className="text-xs text-slate-600">No clicks recorded yet</div>
                    ) : (
                      analyticsData.browsers.map((b, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{b.name}</span>
                          <span className="font-mono text-cyan-400 font-semibold">{b.count} clicks</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Operating Systems */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-slate-400 flex items-center">
                    <Laptop className="w-4 h-4 mr-1.5 text-indigo-400" /> Operating Systems
                  </h3>
                  <div className="space-y-2">
                    {analyticsData.os.length === 0 ? (
                      <div className="text-xs text-slate-600">No clicks recorded yet</div>
                    ) : (
                      analyticsData.os.map((o, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{o.name}</span>
                          <span className="font-mono text-indigo-400 font-semibold">{o.count} clicks</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Devices */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-slate-400 flex items-center">
                    <Smartphone className="w-4 h-4 mr-1.5 text-violet-400" /> Device Distribution
                  </h3>
                  <div className="space-y-2">
                    {analyticsData.devices.length === 0 ? (
                      <div className="text-xs text-slate-600">No clicks recorded yet</div>
                    ) : (
                      analyticsData.devices.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{d.name}</span>
                          <span className="font-mono text-violet-400 font-semibold">{d.count} clicks</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Click Activity Stream */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase text-slate-400 flex items-center">
                  <Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Recent Ingested Click Stream
                </h3>
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Browser</th>
                        <th className="p-3">OS</th>
                        <th className="p-3">Device</th>
                        <th className="p-3">IP Address</th>
                        <th className="p-3">Referer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {analyticsData.recent_clicks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-600">
                            No clicks captured in stream yet. Click the short link or run diagnostic above.
                          </td>
                        </tr>
                      ) : (
                        analyticsData.recent_clicks.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="p-3 text-slate-300">{new Date(c.clicked_at).toLocaleTimeString()}</td>
                            <td className="p-3 text-cyan-300">{c.browser || 'Unknown'}</td>
                            <td className="p-3 text-indigo-300">{c.os || 'Unknown'}</td>
                            <td className="p-3 text-slate-300">{c.device || 'Desktop'}</td>
                            <td className="p-3 text-slate-400">{c.ip_address || '127.0.0.1'}</td>
                            <td className="p-3 text-slate-500 truncate max-w-[150px]">{c.referer || 'Direct'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Enter a short code above or generate a link to load analytics.
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        System Design Practice: Scalable URL Shortener with Edge CDN, Nginx LB, KGS, Kafka KRaft, Redis & PostgreSQL.
      </footer>
    </div>
  );
}

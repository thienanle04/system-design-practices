import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Activity,
  BarChart3,
  Globe,
  Clock,
  Radio,
  Trash2,
  Power,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  Layers,
  Smartphone,
  Laptop,
  Monitor,
  Chrome,
  Apple,
  Terminal,
  Zap,
  X,
  Server,
  Database,
  AlertTriangle,
  Wifi,
  WifiOff,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

// Custom Tooltip for Real-time Click Velocity
const CustomVelocityTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5">
        <div className="text-slate-300 font-mono flex items-center gap-1.5 font-medium text-xs">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>{data.secondsAgo === 0 ? 'Thời điểm hiện tại (0s)' : `Cách đây ${data.secondsAgo} giây`}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-200 font-semibold text-sm">Click Velocity:</span>
          <span className="font-mono font-bold text-white text-base">
            {data.velocity} <span className="text-xs text-slate-300 font-normal">Click Events/giây</span>
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Daily Clicks
const CustomDailyTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 px-3.5 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1">
        <div className="text-slate-400 font-mono flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-violet-400" />
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-400" />
          <span className="text-slate-300 font-medium">Lượt Click Events:</span>
          <span className="font-mono font-bold text-violet-300 text-sm">
            {payload[0].value?.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Ranked Progress Bar Card for Browser, OS & Device Distributions
interface RankedItem {
  name: string;
  count: number;
}

const getCategoryIcon = (category: 'browser' | 'os' | 'device', name: string) => {
  const lower = name.toLowerCase();
  if (category === 'browser') {
    if (lower.includes('chrome')) return <Chrome className="w-3.5 h-3.5 text-amber-400" />;
    if (lower.includes('safari')) return <Apple className="w-3.5 h-3.5 text-blue-400" />;
    return <Globe className="w-3.5 h-3.5 text-indigo-400" />;
  }
  if (category === 'os') {
    if (lower.includes('mac') || lower.includes('ios')) return <Apple className="w-3.5 h-3.5 text-slate-200" />;
    if (lower.includes('linux')) return <Terminal className="w-3.5 h-3.5 text-emerald-400" />;
    return <Laptop className="w-3.5 h-3.5 text-cyan-400" />;
  }
  if (lower.includes('mobile') || lower.includes('phone')) return <Smartphone className="w-3.5 h-3.5 text-violet-400" />;
  return <Monitor className="w-3.5 h-3.5 text-emerald-400" />;
};

const RankedBreakdownCard: React.FC<{
  title: string;
  items: RankedItem[];
  category: 'browser' | 'os' | 'device';
}> = ({ title, items, category }) => {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, item) => sum + item.count, 0);
  const max = sorted.length > 0 ? Math.max(...sorted.map((i) => i.count), 1) : 1;

  return (
    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          {title}
        </h5>
        <span className="text-[11px] font-mono text-slate-500 font-semibold">
          {total} Click Events
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-600">Chưa ghi nhận dữ liệu</div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((item, index) => {
            const pctOfTotal = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const barWidth = Math.max(Math.round((item.count / max) * 100), 4);
            const rank = index + 1;

            const badgeColor =
              rank === 1
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : rank === 2
                ? 'bg-slate-400/20 text-slate-200 border-slate-400/30'
                : rank === 3
                ? 'bg-amber-700/20 text-amber-400 border-amber-700/30'
                : 'bg-slate-800 text-slate-400 border-slate-700/40';

            const barGradient =
              rank === 1
                ? 'bg-gradient-to-r from-violet-500 to-indigo-500'
                : rank === 2
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-500'
                : rank === 3
                ? 'bg-gradient-to-r from-slate-600 to-slate-500'
                : 'bg-slate-700';

            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold border ${badgeColor}`}
                    >
                      {rank}
                    </span>
                    <span className="flex-shrink-0">{getCategoryIcon(category, item.name)}</span>
                    <span className="text-slate-200 font-medium truncate max-w-[110px]" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-right font-mono flex-shrink-0">
                    <span className="text-white font-bold">{item.count}</span>
                    <span className="text-[11px] text-slate-400">({pctOfTotal}%)</span>
                  </div>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barGradient}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


export interface SystemHealthData {
  status: 'Operational' | 'Degraded' | 'Outage';
  timestamp: string;
  summary: string;
  dependencies: {
    postgres: { status: 'UP' | 'DOWN'; latency_ms: number; error?: string };
    redis: { status: 'UP' | 'DOWN'; latency_ms: number; error?: string };
    kafka: { status: 'UP' | 'DOWN'; error?: string };
  };
  kgs: {
    key_buffer_depth: number;
    status: 'HEALTHY' | 'LOW_BUFFER' | 'CRITICAL';
  };
  nodes: {
    instance: string;
    status: 'ALIVE' | 'OFFLINE';
    last_heartbeat: string;
    age_seconds: number;
  }[];
}

export interface LiveClickItem {
  short_code: string;
  original_url?: string;
  device?: string;
  browser?: string;
  os?: string;
  ip_address?: string;
  timestamp: string;
}


interface UrlItem {
  id: number;
  short_code: string;
  short_url: string;
  original_url: string;
  is_custom: boolean;
  is_active: boolean;
  status: 'active' | 'expired' | 'deactivated';
  expires_at: string | null;
  created_at: string;
  total_clicks: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface DiagnosticResult {
  status: number;
  cacheStatus: string;
  serverInstance: string;
  latencyMs: number;
  targetLocation?: string;
  timestamp: string;
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

export const Dashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  // Table State
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  });
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'deactivated'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Diagnostics Modal State
  const [diagnosticCode, setDiagnosticCode] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);

  // Analytics Modal State
  const [analyticsCode, setAnalyticsCode] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Edit Expiration Modal State
  const [editingUrl, setEditingUrl] = useState<UrlItem | null>(null);
  const [editDays, setEditDays] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // System Health & Real-time State (ADR-0006)
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [sessionClickCount, setSessionClickCount] = useState(0);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const [liveOutsideClicks, setLiveOutsideClicks] = useState(0);

  // Click Velocity Sliding Window (60 seconds, 1-second resolution)
  const [velocityBuckets, setVelocityBuckets] = useState<number[]>(() => new Array(60).fill(0));
  const currentSecondAcc = React.useRef(0);
  const [currentVelocity, setCurrentVelocity] = useState(0);
  const [deviceStats, setDeviceStats] = useState<{ desktop: number; mobile: number }>({ desktop: 0, mobile: 0 });
  const [shortCodeCounts, setShortCodeCounts] = useState<Record<string, number>>({});

  // 1-Second Continuous Drift Ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      const clicksInLastSec = currentSecondAcc.current;
      currentSecondAcc.current = 0;
      setCurrentVelocity(clicksInLastSec);
      setVelocityBuckets((prev) => [...prev.slice(1), clicksInLastSec]);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Fetch System Health Snapshot
  const fetchSystemHealth = async () => {
    try {
      const res = await fetch('/api/v1/system/status');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    } finally {
      setIsHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
    const timer = setInterval(fetchSystemHealth, 10000);
    return () => clearInterval(timer);
  }, []);

  // Server-Sent Events (SSE) for Real-time Clicks (ADR-0006)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/v1/events/live');

        eventSource.onopen = () => {
          if (isMounted) setSseConnected(true);
        };

        eventSource.onmessage = (e) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.type === 'connected') {
              setSseConnected(true);
              return;
            }
            if (parsed.type === 'click' || parsed.short_code) {
              const item: LiveClickItem = parsed.data || parsed;
              setSessionClickCount((prev) => prev + 1);
              currentSecondAcc.current += 1;

              // Track device breakdown
              const isMobile = item.device === 'Mobile';
              setDeviceStats((prev) => ({
                desktop: prev.desktop + (isMobile ? 0 : 1),
                mobile: prev.mobile + (isMobile ? 1 : 0),
              }));

              // Track top short codes
              if (item.short_code) {
                setShortCodeCounts((prev) => ({
                  ...prev,
                  [item.short_code]: (prev[item.short_code] || 0) + 1,
                }));
              }

              // Highlight short code
              setHighlightedCode(item.short_code);
              setTimeout(() => setHighlightedCode(null), 2000);

              // Increment in current table view or increment liveOutsideClicks
              setUrls((prevUrls) => {
                const found = prevUrls.some((u) => u.short_code === item.short_code);
                if (found) {
                  return prevUrls.map((u) =>
                    u.short_code === item.short_code
                      ? { ...u, total_clicks: u.total_clicks + 1 }
                      : u
                  );
                } else {
                  setLiveOutsideClicks((prev) => prev + 1);
                  return prevUrls;
                }
              });
            }
          } catch (err) {
            console.error('Failed to parse SSE payload:', err);
          }
        };

        eventSource.onerror = () => {
          if (isMounted) setSseConnected(false);
        };
      } catch (err) {
        if (isMounted) setSseConnected(false);
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);


  // Fetch URLs List
  const fetchUrls = async (page = pagination.page) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        status: statusFilter,
      });
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const res = await fetch(`/api/v1/urls?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch URLs');
      }

      setUrls(json.data || []);
      setPagination(json.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUrls(1);
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUrls(1);
  };

  const handleCopy = (code: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Toggle Deactivation (Soft Delete / Reactivate)
  const handleToggleActive = async (item: UrlItem) => {
    try {
      const nextActive = !item.is_active;
      const res = await fetch(`/api/v1/urls/${item.short_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update URL status');
      }

      // Update in local state
      setUrls((prev) =>
        prev.map((u) => (u.short_code === item.short_code ? { ...u, is_active: json.is_active, status: json.status } : u))
      );
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Save Expiration
  const handleSaveExpiration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUrl) return;
    setIsUpdating(true);

    try {
      let expiresAt: string | null = null;
      if (editDays) {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(editDays, 10));
        expiresAt = d.toISOString();
      }

      const res = await fetch(`/api/v1/urls/${editingUrl.short_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_at: expiresAt }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update expiration');
      }

      setUrls((prev) =>
        prev.map((u) => (u.short_code === editingUrl.short_code ? { ...u, expires_at: json.expires_at, status: json.status } : u))
      );
      setEditingUrl(null);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Diagnostics runner
  const runDiagnostic = async (code: string) => {
    setIsDiagnosing(true);
    const start = performance.now();
    try {
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
    } catch (err) {
      console.error(err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const openDiagnosticsModal = (code: string) => {
    setDiagnosticCode(code);
    setDiagnostics([]);
    runDiagnostic(code);
  };

  // Fetch Analytics
  const openAnalyticsModal = async (code: string) => {
    setAnalyticsCode(code);
    setIsAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`/api/v1/urls/${code}/analytics`);
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

  // Compute stats
  const totalUrls = pagination.total;
  const activeCount = urls.filter((u) => u.status === 'active').length;
  const totalClicksAll =
    urls.reduce((acc, curr) => acc + curr.total_clicks, 0) + liveOutsideClicks;

  // Real-time Click Velocity metrics & calculations
  const totalDeviceClicks = deviceStats.desktop + deviceStats.mobile;
  const desktopPct = totalDeviceClicks > 0 ? Math.round((deviceStats.desktop / totalDeviceClicks) * 100) : 0;
  const mobilePct = totalDeviceClicks > 0 ? Math.round((deviceStats.mobile / totalDeviceClicks) * 100) : 0;
  const peakVelocity = Math.max(...velocityBuckets, currentVelocity);
  const maxScale = Math.max(peakVelocity, 5);

  // Map 60 1-second velocity buckets for Recharts AreaChart
  const velocityChartData = velocityBuckets.map((val, idx) => ({
    secondsAgo: 59 - idx,
    timeOffset: idx === 59 ? '0s' : `-${59 - idx}s`,
    velocity: val,
  }));
  const topShortCodeEntry = Object.entries(shortCodeCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-8 py-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center">
            <Activity className="w-7 h-7 mr-3 text-indigo-400" />
            Dashboard Quản Lý URLs & Hệ Thống
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Theo dõi trạng thái hệ thống, quan sát Edge CDN & Load Balancer, và thu thập Click Stream thời gian thực qua SSE.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          {/* Real-time SSE Connection Indicator (ADR-0006) */}
          {sseConnected ? (
            <div className="inline-flex items-center space-x-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>LIVE SSE</span>
              {sessionClickCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-[10px] text-emerald-300 font-bold">
                  +{sessionClickCount} clicks
                </span>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center space-x-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Đang kết nối SSE...</span>
            </div>
          )}

          <button
            onClick={() => {
              fetchUrls(pagination.page);
              fetchSystemHealth();
            }}
            disabled={isLoading || isHealthLoading}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isHealthLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* System Health Status Banner (ADR-0006) */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          systemHealth?.status === 'Operational'
            ? 'bg-emerald-950/20 border-emerald-500/30'
            : systemHealth?.status === 'Degraded'
            ? 'bg-amber-950/20 border-amber-500/30'
            : systemHealth?.status === 'Outage'
            ? 'bg-rose-950/20 border-rose-500/30'
            : 'bg-slate-900/60 border-slate-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl flex-shrink-0 ${
                systemHealth?.status === 'Operational'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : systemHealth?.status === 'Degraded'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {systemHealth?.status === 'Operational' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : systemHealth?.status === 'Degraded' ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white">
                  {systemHealth?.status === 'Operational'
                    ? 'Tất Cả Hệ Thống Hoạt Động Bình Thường'
                    : systemHealth?.status === 'Degraded'
                    ? 'Hiệu Năng Hệ Thống Bị Suy Giảm'
                    : systemHealth?.status === 'Outage'
                    ? 'Hệ Thống Đang Gặp Sự Cố (Outage)'
                    : 'Đang kiểm tra sức khỏe hệ thống...'}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    systemHealth?.status === 'Operational'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : systemHealth?.status === 'Degraded'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {systemHealth?.status || 'Probing'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {systemHealth?.summary || 'Đang cập nhật snapshot từ Redis cache...'}
                {systemHealth?.timestamp && (
                  <span className="text-slate-500 ml-2">
                    • Cập nhật: {new Date(systemHealth.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-300 self-end lg:self-auto overflow-x-auto">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>PG:</span>
              <strong
                className={
                  systemHealth?.dependencies.postgres.status === 'UP'
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }
              >
                {systemHealth?.dependencies.postgres.latency_ms ?? 0}ms
              </strong>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Redis:</span>
              <strong
                className={
                  systemHealth?.dependencies.redis.status === 'UP'
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }
              >
                {systemHealth?.dependencies.redis.latency_ms ?? 0}ms
              </strong>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              <span>Kafka:</span>
              <strong
                className={
                  systemHealth?.dependencies.kafka.status === 'UP'
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }
              >
                {systemHealth?.dependencies.kafka.status ?? 'CHECKING'}
              </strong>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nodes:</span>
              <strong className="text-white">
                {systemHealth?.nodes.filter((n) => n.status === 'ALIVE').length ?? 0}/
                {Math.max(systemHealth?.nodes.length ?? 0, 2)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4 System Observability Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Postgres & Redis */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
                <Database className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                Database & Cache
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  systemHealth?.dependencies.postgres.status === 'UP' &&
                  systemHealth?.dependencies.redis.status === 'UP'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {systemHealth?.dependencies.postgres.status === 'UP' &&
                systemHealth?.dependencies.redis.status === 'UP'
                  ? 'HEALTHY'
                  : 'DEGRADED'}
              </span>
            </div>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span className="text-slate-500">PostgreSQL (Drizzle):</span>
                <span className="font-mono text-indigo-300 font-bold">
                  {systemHealth?.dependencies.postgres.latency_ms ?? 0} ms
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span className="text-slate-500">Redis Cache & Locks:</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {systemHealth?.dependencies.redis.latency_ms ?? 0} ms
                </span>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-3 border-t border-slate-800/80 pt-2">
            Độ trễ truy vấn trực tiếp & in-memory cache
          </div>
        </div>

        {/* Card 2: Kafka & SSE Live Stream */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
                <Radio className="w-3.5 h-3.5 mr-1.5 text-violet-400" />
                Streaming & Pub/Sub
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  systemHealth?.dependencies.kafka.status === 'UP' && sseConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {systemHealth?.dependencies.kafka.status === 'UP' ? 'KAFKA UP' : 'DISCONNECTED'}
              </span>
            </div>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span className="text-slate-500">Kafka Broker:</span>
                <span className="font-mono text-violet-300 font-bold">
                  {systemHealth?.dependencies.kafka.status || 'OK'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span className="text-slate-500">SSE Fan-out (Session):</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {sessionClickCount} live clicks
                </span>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-3 border-t border-slate-800/80 pt-2">
            Luồng sự kiện click stream & Redis fan-out
          </div>
        </div>

        {/* Card 3: KGS Key Buffer Depth */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
                <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                Key Buffer (KGS)
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  (systemHealth?.kgs.key_buffer_depth ?? 0) >= 1000
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {systemHealth?.kgs.status || 'HEALTHY'}
              </span>
            </div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold font-mono text-white">
                {(systemHealth?.kgs.key_buffer_depth ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">/ 10,000 keys</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (systemHealth?.kgs.key_buffer_depth ?? 0) >= 1000 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{
                  width: `${Math.min(100, ((systemHealth?.kgs.key_buffer_depth ?? 0) / 10000) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-3 border-t border-slate-800/80 pt-2">
            Pre-generated Base62 keys sẵn sàng trong Redis
          </div>
        </div>

        {/* Card 4: Service Nodes */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
                <Server className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                API Service Nodes
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {systemHealth?.nodes.filter((n) => n.status === 'ALIVE').length ?? 0} ACTIVE
              </span>
            </div>
            <div className="space-y-1.5 mt-2">
              {(systemHealth?.nodes && systemHealth.nodes.length > 0
                ? systemHealth.nodes
                : [
                    { instance: 'url-service-1', status: 'ALIVE', age_seconds: 1, last_heartbeat: '' },
                    { instance: 'url-service-2', status: 'ALIVE', age_seconds: 1, last_heartbeat: '' },
                  ]
              ).map((node) => (
                <div key={node.instance} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-300 flex items-center">
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        node.status === 'ALIVE' ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                    />
                    {node.instance}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {node.age_seconds}s ago
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-3 border-t border-slate-800/80 pt-2">
            Load Balancer phân phối vòng tròn (Round-robin)
          </div>
        </div>
      </div>

      {/* Real-time Click Velocity Monitor (ADR-0006) */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl relative overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Real-time Click Velocity
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                  Cửa sổ trượt 60s
                </span>
              </h3>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span className={`inline-block w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
                <span className="font-medium">{sseConnected ? 'Luồng SSE Live Stream đang đồng bộ trực tiếp' : 'Mất kết nối SSE'}</span>
              </div>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Current Velocity */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 font-medium">Tức thời:</span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {currentVelocity} <span className="text-xs font-normal text-slate-400">c/s</span>
              </span>
            </div>

            {/* Peak Velocity */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-300 font-medium">Đỉnh 60s:</span>
              <span className="font-mono font-bold text-indigo-300 text-sm">
                {peakVelocity} <span className="text-xs font-normal text-slate-400">c/s</span>
              </span>
            </div>

            {/* Device Breakdown */}
            {totalDeviceClicks > 0 && (
              <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div className="flex items-center space-x-1.5 text-slate-200">
                  <Laptop className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold">{desktopPct}% Desktop</span>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center space-x-1.5 text-slate-200">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold">{mobilePct}% Mobile</span>
                </div>
              </div>
            )}

            {/* Top Short Code in Session */}
            {topShortCodeEntry && (
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-indigo-950/60 border border-indigo-700/50 text-xs">
                <span className="text-indigo-300 font-medium">Top:</span>
                <span className="font-mono font-bold text-white">
                  /{topShortCodeEntry[0]}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-900/80 text-indigo-200 font-bold">
                  {topShortCodeEntry[1]} clicks
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="relative w-full h-72 bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={velocityChartData} margin={{ top: 16, right: 20, left: -6, bottom: 6 }}>
              <defs>
                <linearGradient id="velocityAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.45} />
                  <stop offset="50%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="secondsAgo"
                stroke="#94a3b8"
                fontSize={12}
                fontWeight={500}
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
                reversed={true}
                ticks={[60, 45, 30, 15, 0]}
                tickFormatter={(val) => (val === 0 ? 'Bây giờ (0s)' : `-${val}s`)}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                fontWeight={500}
                tickLine={false}
                axisLine={false}
                domain={[0, maxScale]}
                allowDecimals={false}
                tickFormatter={(val) => `${val}/s`}
              />
              <Tooltip content={<CustomVelocityTooltip />} />
              <Area
                type="monotone"
                dataKey="velocity"
                stroke="#818cf8"
                strokeWidth={2.5}
                fill="url(#velocityAreaGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Empty State Overlay if 0 clicks in entire window */}
          {peakVelocity === 0 && sessionClickCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
              <span className="text-xs sm:text-sm text-slate-200 font-medium bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-700/80 shadow-lg backdrop-blur-md flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Đang lắng nghe Click Velocity... Mở một Short URL để kích hoạt xung nhịp thời gian thực!
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Tổng Short URLs
          </div>
          <div className="text-2xl font-bold text-white">{totalUrls}</div>
          <div className="text-xs text-slate-500 mt-1">Toàn bộ links đã tạo</div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Đang Hoạt Động
          </div>
          <div className="text-2xl font-bold text-emerald-400">{activeCount}</div>
          <div className="text-xs text-slate-500 mt-1">Trong trang hiện tại</div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Tổng Lượt Clicks
          </div>
          <div className="text-2xl font-bold text-violet-400">{totalClicksAll}</div>
          <div className="text-xs text-slate-500 mt-1">
            {liveOutsideClicks > 0 ? `+${liveOutsideClicks} live clicks mới` : 'Thu thập qua Kafka'}
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Edge CDN Caching
          </div>
          <div className="text-2xl font-bold text-cyan-400">30s TTL</div>
          <div className="text-xs text-slate-500 mt-1">Negative cache 60s</div>
        </div>
      </div>


      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo Short Code hoặc Target Destination URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition"
          >
            Tìm kiếm
          </button>
        </form>

        {/* Status Pills */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
          {(['all', 'active', 'expired', 'deactivated'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st === 'all'
                ? 'Tất cả'
                : st === 'active'
                ? 'Đang hoạt động'
                : st === 'expired'
                ? 'Hết hạn'
                : 'Đã vô hiệu'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <p className="text-sm">Đang tải danh sách Short URLs...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-400 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : urls.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-2">
            <p className="text-base font-semibold text-slate-400">Không tìm thấy Short URL nào</p>
            <p className="text-xs">Hãy tạo link mới ở Trang chủ hoặc thay đổi từ khóa tìm kiếm.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Short Code</th>
                  <th className="py-3.5 px-4">Target URL</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Hạn dùng</th>
                  <th className="py-3.5 px-4 text-center">Clicks</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {urls.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-800/30 transition duration-300 ${
                      highlightedCode === item.short_code
                        ? 'bg-indigo-950/60 ring-1 ring-indigo-500/80 shadow-lg shadow-indigo-500/10'
                        : ''
                    }`}
                  >
                    {/* Short Code */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-indigo-300">
                          {item.short_code}
                        </span>
                        <button
                          onClick={() => handleCopy(item.short_code, item.short_url)}
                          className="p-1 rounded text-slate-500 hover:text-slate-300 transition"
                          title="Copy short link"
                        >
                          {copiedCode === item.short_code ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            item.is_custom
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {item.is_custom ? 'Custom' : 'KGS'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Target URL */}
                    <td className="py-3.5 px-4 max-w-xs sm:max-w-sm truncate">
                      <a
                        href={item.original_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-300 hover:text-white flex items-center space-x-1 truncate"
                        title={item.original_url}
                      >
                        <span className="truncate">{item.original_url}</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                      </a>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.status === 'active' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      ) : item.status === 'expired' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Expired (410)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Deactivated (410)
                        </span>
                      )}
                    </td>

                    {/* Expiration */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400">
                      {item.expires_at ? (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{new Date(item.expires_at).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Vĩnh viễn</span>
                      )}
                    </td>

                    {/* Total Clicks */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                        {item.total_clicks}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-1">
                      {/* Test CDN / LB */}
                      <button
                        onClick={() => openDiagnosticsModal(item.short_code)}
                        className="p-1.5 rounded-lg bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 transition"
                        title="Kiểm tra Live Edge CDN & LB"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>

                      {/* View Analytics */}
                      <button
                        onClick={() => openAnalyticsModal(item.short_code)}
                        className="p-1.5 rounded-lg bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 transition"
                        title="Xem Kafka Analytics"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Expiration */}
                      <button
                        onClick={() => {
                          setEditingUrl(item);
                          setEditDays('');
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Gia hạn / Đổi thời hạn"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>

                      {/* Toggle Deactivate / Reactivate */}
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`p-1.5 rounded-lg transition ${
                          item.is_active
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                        }`}
                        title={item.is_active ? 'Vô hiệu hoá (Soft Deactivate)' : 'Kích hoạt lại'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <div>
            Trang <strong className="text-slate-200">{pagination.page}</strong> / {pagination.total_pages} (Tổng {pagination.total} URLs)
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => fetchUrls(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchUrls(pagination.page + 1)}
              disabled={pagination.page >= pagination.total_pages || isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Diagnostics Modal / Slide-over */}
      {diagnosticCode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">
                  Edge CDN & LB Test: <code className="font-mono text-cyan-300">/{diagnosticCode}</code>
                </h3>
              </div>
              <button
                onClick={() => setDiagnosticCode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Gửi HEAD request tới Edge CDN Nginx. Quan sát <code className="text-cyan-300 font-mono">X-Cache-Status</code> (MISS lần đầu, HIT trong 30s) và phân phối qua <code className="text-indigo-300 font-mono">X-Server-Instance</code>.
            </p>

            {/* Diagnostic Logs */}
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/80 overflow-y-auto max-h-[260px] space-y-2 font-mono text-xs">
              {diagnostics.length === 0 ? (
                <div className="text-center py-8 text-slate-600">Đang gửi request...</div>
              ) : (
                diagnostics.map((diag, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{diag.timestamp}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          diag.cacheStatus === 'HIT'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        CDN: {diag.cacheStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Status: {diag.status} • Server: {diag.serverInstance}</span>
                      <span className="text-cyan-400">{diag.latencyMs}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => runDiagnostic(diagnosticCode)}
                disabled={isDiagnosing}
                className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isDiagnosing ? 'animate-spin' : ''}`} />
                <span>Gửi Test Request Tiếp</span>
              </button>
              <button
                onClick={() => setDiagnosticCode(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {analyticsCode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-violet-400" />
                <h3 className="text-lg font-bold text-white">
                  Kafka Click Stream Analytics: <code className="font-mono text-violet-300">/{analyticsCode}</code>
                </h3>
              </div>
              <button
                onClick={() => {
                  setAnalyticsCode(null);
                  setAnalyticsData(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isAnalyticsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
                <p className="text-sm">Đang tải báo cáo click stream từ Kafka / DB...</p>
              </div>
            ) : analyticsError ? (
              <div className="py-12 text-center text-rose-400 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto" />
                <p className="text-sm font-semibold">{analyticsError}</p>
              </div>
            ) : analyticsData ? (
              <div className="space-y-6">
                {/* Analytics Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="text-xs text-slate-400">Tổng Lượt Click Events</div>
                    <div className="text-2xl font-bold text-violet-400">{analyticsData.total_clicks}</div>
                  </div>
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="text-xs text-slate-400">Ngày Tạo</div>
                    <div className="text-sm font-semibold text-slate-200 mt-1">
                      {new Date(analyticsData.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="text-xs text-slate-400">Hạn Dùng</div>
                    <div className="text-sm font-semibold text-slate-200 mt-1">
                      {analyticsData.expires_at ? new Date(analyticsData.expires_at).toLocaleDateString() : 'Vĩnh viễn'}
                    </div>
                  </div>
                </div>

                {/* Daily Bar Chart */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-violet-400" />
                      Lượt Click Events Theo Ngày
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {analyticsData.daily_clicks.reduce((acc, curr) => acc + curr.clicks, 0)} Click Events đã ghi nhận
                    </span>
                  </div>

                  {analyticsData.daily_clicks.length === 0 ? (
                    <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center text-xs text-slate-600">
                      Chưa ghi nhận lượt Click Event nào theo ngày
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={analyticsData.daily_clicks}
                            margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
                          >
                            <defs>
                              <linearGradient id="dailyBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.95} />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                              dataKey="date"
                              stroke="#94a3b8"
                              fontSize={12}
                              fontWeight={500}
                              tickLine={false}
                              axisLine={{ stroke: '#475569' }}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              fontSize={12}
                              fontWeight={500}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip content={<CustomDailyTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                            <Bar
                              dataKey="clicks"
                              fill="url(#dailyBarGradient)"
                              radius={[6, 6, 0, 0]}
                              name="Click Events"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                {/* Device, Browser & OS Breakdowns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <RankedBreakdownCard
                    title="Trình duyệt"
                    category="browser"
                    items={analyticsData.browsers}
                  />
                  <RankedBreakdownCard
                    title="Hệ điều hành"
                    category="os"
                    items={analyticsData.os}
                  />
                  <RankedBreakdownCard
                    title="Thiết bị"
                    category="device"
                    items={analyticsData.devices}
                  />
                </div>

                {/* Recent 20 Click Events Audit Log */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    20 Lượt Click Events Gần Nhất
                  </h4>
                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto max-h-[220px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 font-medium">
                          <th className="p-2.5">Thời gian</th>
                          <th className="p-2.5">IP</th>
                          <th className="p-2.5">Thiết bị</th>
                          <th className="p-2.5">Trình duyệt / OS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {analyticsData.recent_clicks.map((rc, idx) => (
                          <tr key={idx} className="text-slate-300">
                            <td className="p-2.5 whitespace-nowrap text-slate-400">
                              {new Date(rc.clicked_at).toLocaleTimeString()}{' '}
                              <span className="text-[10px] text-slate-600">
                                {new Date(rc.clicked_at).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-400">
                              {rc.ip_address || '127.0.0.1'}
                            </td>
                            <td className="p-2.5">{rc.device || 'Desktop'}</td>
                            <td className="p-2.5">
                              {rc.browser || 'Unknown'} / {rc.os || 'Unknown'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Edit Expiration Modal */}
      {editingUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  Gia hạn / Đổi thời hạn: <code className="font-mono text-indigo-300">/{editingUrl.short_code}</code>
                </h3>
              </div>
              <button
                onClick={() => setEditingUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpiration} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Gia hạn thêm
                </label>
                <select
                  value={editDays}
                  onChange={(e) => setEditDays(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="">Vĩnh viễn (Không hết hạn)</option>
                  <option value="1">+ 1 Ngày từ hôm nay</option>
                  <option value="7">+ 7 Ngày từ hôm nay</option>
                  <option value="30">+ 30 Ngày từ hôm nay</option>
                  <option value="90">+ 90 Ngày từ hôm nay</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  <span>Lưu thay đổi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUrl(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

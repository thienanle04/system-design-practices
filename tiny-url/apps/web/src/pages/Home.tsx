import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Globe,
  Layers,
  Activity,
  Radio,
  Server,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Copy,
  ExternalLink,
  User,
  Key,
  Crown,
} from 'lucide-react';

interface CreateResponse {
  short_code: string;
  short_url: string;
  original_url: string;
  is_custom: boolean;
  expires_at: string | null;
  created_at: string;
  served_by: string;
  tier?: string;
}

interface TierStats {
  tier: 'guest' | 'free' | 'paid';
  rateLimit: number;
  rateRemaining: number;
  quotaLimit: number;
  quotaRemaining: number;
}

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<'guest' | 'free' | 'paid'>('guest');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [tierStats, setTierStats] = useState<TierStats | null>(null);

  const handleCreateUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload: any = { original_url: originalUrl };
      if (customAlias.trim()) payload.custom_alias = customAlias.trim();
      if (expiresInDays) payload.expires_in_days = parseInt(expiresInDays, 10);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (selectedTier === 'free') {
        headers['X-API-Key'] = 'free_demo_key';
      } else if (selectedTier === 'paid') {
        headers['X-API-Key'] = 'paid_demo_key';
      }

      const res = await fetch('/api/v1/urls', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      // Extract rate limit and quota headers (ADR-0010)
      const rateLimitHeader = res.headers.get('RateLimit-Limit');
      const rateRemainingHeader = res.headers.get('RateLimit-Remaining');
      const quotaLimitHeader = res.headers.get('X-Daily-Quota-Limit');
      const quotaRemainingHeader = res.headers.get('X-Daily-Quota-Remaining');

      if (rateLimitHeader && rateRemainingHeader && quotaLimitHeader && quotaRemainingHeader) {
        setTierStats({
          tier: selectedTier,
          rateLimit: parseInt(rateLimitHeader, 10),
          rateRemaining: parseInt(rateRemainingHeader, 10),
          quotaLimit: parseInt(quotaLimitHeader, 10),
          quotaRemaining: parseInt(quotaRemainingHeader, 10),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create short URL');
      }

      setSuccessData(data);
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

  return (
    <div className="space-y-12 py-6">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" />
          <span>High-Throughput Distributed URL Shortener</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
          Rút gọn liên kết siêu tốc, an toàn và phân tán
        </h1>
        <p className="text-base sm:text-lg text-slate-400">
          Tạo Short URL tức thời với mã phân bổ từ Key Generation Service (KGS), đệm qua Redis, phân giải định tuyến dưới 2ms và thu thập sự kiện truy cập qua Apache Kafka.
        </p>
      </div>

      {/* Main Form Container */}
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Tier Selector Tab Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-1 mb-1">
            Chọn Phân Cấp Tài Khoản (Account Tier - ADR-0010):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedTier('guest')}
              className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 ${
                selectedTier === 'guest'
                  ? 'bg-indigo-600/20 border-indigo-500 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className={`w-5 h-5 flex-shrink-0 ${selectedTier === 'guest' ? 'text-indigo-400' : 'text-slate-500'}`} />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">Khách (Guest)</div>
                <div className="text-[10px] text-slate-400">5 req/m • 20 link/ngày</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTier('free')}
              className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 ${
                selectedTier === 'free'
                  ? 'bg-indigo-600/20 border-indigo-500 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className={`w-5 h-5 flex-shrink-0 ${selectedTier === 'free' ? 'text-indigo-400' : 'text-slate-500'}`} />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">Tài Khoản Free (Demo)</div>
                <div className="text-[10px] text-slate-400">30 req/m • 500 link/ngày</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTier('paid')}
              className={`p-3 rounded-xl border text-left transition flex items-center space-x-3 ${
                selectedTier === 'paid'
                  ? 'bg-amber-600/20 border-amber-500 text-amber-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crown className={`w-5 h-5 flex-shrink-0 ${selectedTier === 'paid' ? 'text-amber-400' : 'text-slate-500'}`} />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">Tài Khoản VIP (Paid)</div>
                <div className="text-[10px] text-slate-400">300 req/m • 50k link/ngày</div>
              </div>
            </button>
          </div>
        </div>

        {/* Form Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <form onSubmit={handleCreateUrl} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Địa chỉ liên kết đích (Target URL) *
              </label>
              <div className="relative">
                <input
                  type="url"
                  required
                  placeholder="https://example.com/very/long/destination/article-or-webpage"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition font-sans text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Custom Alias (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="vi-du-link-dep"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Không dùng các từ khóa hệ thống: <code className="text-slate-400 font-mono">dashboard</code>, <code className="text-slate-400 font-mono">admin</code>, <code className="text-slate-400 font-mono">api</code>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Thời hạn liên kết (Link Expiration)
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-sm"
                >
                  <option value="">Vĩnh viễn (Không hết hạn)</option>
                  <option value="1">1 Ngày</option>
                  <option value="7">7 Ngày</option>
                  <option value="30">30 Ngày</option>
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block flex items-center">
                  <Clock className="w-3 h-3 mr-1" /> Trả về HTTP 410 Gone sau khi hết hạn
                </span>
              </div>
            </div>

            {/* Live Rate Limit / Quota Remaining Badge */}
            {tierStats && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>Trạng thái Hạn mức ({tierStats.tier.toUpperCase()}):</span>
                </div>
                <div className="flex items-center space-x-3 font-mono">
                  <span className="text-slate-300">
                    Tốc độ: <strong className="text-white">{tierStats.rateRemaining}/{tierStats.rateLimit}</strong> req/phút
                  </span>
                  <span>•</span>
                  <span className="text-slate-300">
                    Quota ngày: <strong className="text-emerald-400">{tierStats.quotaRemaining}/{tierStats.quotaLimit}</strong> links
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50 text-sm"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang cấp phát mã từ KGS...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Tạo Short URL Ngay</span>
                </>
              )}
            </button>
          </form>

          {/* Success Result Box */}
          {successData && (
            <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Tạo Short URL thành công
                </span>
                <span className="text-xs text-slate-400">Node: {successData.served_by}</span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={successData.short_url}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-indigo-500/40 text-indigo-200 font-mono text-sm focus:outline-none select-all"
                />
                <button
                  onClick={() => handleCopy(successData.short_url)}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center justify-center"
                  title="Sao chép vào clipboard"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={successData.short_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center"
                  title="Mở liên kết trong tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <span>Loại: <strong className="text-slate-300">{successData.is_custom ? 'Custom Alias' : 'KGS Base62'}</strong></span>
                  <span>•</span>
                  <span>{successData.expires_at ? `Hết hạn: ${new Date(successData.expires_at).toLocaleDateString()}` : 'Vĩnh viễn'}</span>
                  {successData.tier && (
                    <>
                      <span>•</span>
                      <span className="uppercase font-semibold text-indigo-300">Tier: {successData.tier}</span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/dashboard?search=${encodeURIComponent(successData.short_code)}`)}
                  className="inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-semibold transition"
                >
                  <span>Quản lý & xem analytics trong Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Architecture Highlights */}
      <div className="max-w-5xl mx-auto pt-6">
        <div className="text-center mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Hạ Tầng Phân Tán Đằng Sau Mỗi Request</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-[11px] text-slate-400">Edge Tier</div>
              <div className="text-xs font-bold text-white">Nginx CDN (30s)</div>
            </div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="text-[11px] text-slate-400">Load Balancer</div>
              <div className="text-xs font-bold text-white">Round-Robin (x2)</div>
            </div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[11px] text-slate-400">Key Gen (KGS)</div>
              <div className="text-xs font-bold text-white">O(1) Redis Pool</div>
            </div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
            <Activity className="w-5 h-5 text-red-400" />
            <div>
              <div className="text-[11px] text-slate-400">Cache Layer</div>
              <div className="text-xs font-bold text-white">Negative TTL 60s</div>
            </div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
            <Radio className="w-5 h-5 text-violet-400" />
            <div>
              <div className="text-[11px] text-slate-400">Event Broker</div>
              <div className="text-xs font-bold text-white">Kafka KRaft</div>
            </div>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
            <Server className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-[11px] text-slate-400">Primary DB</div>
              <div className="text-xs font-bold text-white">PostgreSQL 16</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

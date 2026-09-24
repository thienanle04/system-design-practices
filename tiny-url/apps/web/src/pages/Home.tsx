import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link as LinkIcon,
  Copy,
  ExternalLink,
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
  RefreshCw
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

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

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
      <div className="max-w-3xl mx-auto">
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

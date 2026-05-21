"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Episode {
  id: number;
  title: string;
  pub_date: string;
  duration: string;
  status: "pending" | "transcribing" | "done" | "error";
  description: string;
  error_msg: string | null;
  updated_at: string | null;
  analysis_status: "pending" | "analyzing" | "done" | "error";
  rec_stocks: string[];
  unrec_stocks: string[];
  rec_industries: string[];
  unrec_industries: string[];
}

const STATUS_LABEL: Record<Episode["status"], string> = {
  pending: "未轉錄",
  transcribing: "轉錄中",
  done: "已完成",
  error: "錯誤",
};

const STATUS_CLASS: Record<Episode["status"], string> = {
  pending: "bg-gray-700 text-gray-300",
  transcribing: "bg-yellow-500/20 text-yellow-300 animate-pulse",
  done: "bg-green-500/20 text-green-400",
  error: "bg-red-500/20 text-red-400",
};

function formatDuration(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) {
    const [h, m] = parts;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  const secs = Number(raw);
  if (!isNaN(secs)) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  return raw;
}

function formatDate(raw: string): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return raw;
  }
}

function Chips({
  items,
  color,
}: {
  items: string[];
  color: string;
}) {
  if (!items?.length) return null;
  const show = items.slice(0, 3);
  const rest = items.length - show.length;
  return (
    <span className="flex flex-wrap gap-1 items-center">
      {show.map((s) => (
        <span key={s} className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
          {s}
        </span>
      ))}
      {rest > 0 && <span className="text-xs text-gray-500">+{rest}</span>}
    </span>
  );
}

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState<Set<number>>(new Set());

  const loadEpisodes = useCallback(async () => {
    try {
      const res = await fetch("/api/episodes?limit=1000");
      const data = await res.json();
      const sorted = [...data.episodes].sort(
        (a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime()
      );
      setEpisodes(sorted);
    } catch {
      // backend not yet up
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEpisodes();
    const interval = setInterval(loadEpisodes, 5000);
    return () => clearInterval(interval);
  }, [loadEpisodes]);

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/sync", { method: "POST" });
    setTimeout(() => { loadEpisodes(); setSyncing(false); }, 1500);
  }

  async function handleTranscribe(id: number) {
    setBusy((p) => new Set(p).add(id));
    await fetch(`/api/episodes/${id}/transcribe`, { method: "POST" });
    await loadEpisodes();
    setBusy((p) => { const n = new Set(p); n.delete(id); return n; });
  }

  async function handleAnalyze(id: number) {
    setBusy((p) => new Set(p).add(id));
    await fetch(`/api/episodes/${id}/analyze`, { method: "POST" });
    await loadEpisodes();
    setBusy((p) => { const n = new Set(p); n.delete(id); return n; });
  }

  const filtered = episodes.filter((ep) =>
    ep.title.toLowerCase().includes(query.toLowerCase())
  );

  const stats = {
    total: episodes.length,
    done: episodes.filter((e) => e.status === "done").length,
    analyzed: episodes.filter((e) => e.analysis_status === "done").length,
    transcribing: episodes.filter((e) => e.status === "transcribing").length,
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-400">股癌 Podcast</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gooaye · 自動轉錄文字稿</p>
          {!loading && (
            <p className="text-xs text-gray-500 mt-1">
              共 {stats.total} 集 · 轉錄 {stats.done} 集 · 分析 {stats.analyzed} 集
              {stats.transcribing > 0 && ` · 轉錄中 ${stats.transcribing} 集`}
            </p>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {syncing ? "同步中…" : "同步新集數"}
        </button>
      </div>

      <input
        type="text"
        placeholder="搜尋集數標題…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-green-500 mb-4"
      />

      {loading ? (
        <div className="text-center py-20 text-gray-500">載入中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {query ? "找不到符合的集數" : "尚無集數資料"}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ep) => (
            <div
              key={ep.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[ep.status]}`}>
                      {STATUS_LABEL[ep.status]}
                    </span>
                    {ep.pub_date && (
                      <span className="text-xs text-gray-500">{formatDate(ep.pub_date)}</span>
                    )}
                    {ep.duration && (
                      <span className="text-xs text-gray-500">{formatDuration(ep.duration)}</span>
                    )}
                  </div>
                  <h2 className="text-sm font-medium text-gray-100 leading-snug">
                    {ep.title}
                  </h2>

                  {/* Analysis chips */}
                  {ep.analysis_status === "done" && (
                    <div className="mt-2 space-y-1">
                      {(ep.rec_stocks?.length > 0 || ep.rec_industries?.length > 0) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                          <span className="text-xs text-green-500">📈</span>
                          <Chips items={ep.rec_stocks} color="bg-green-900/60 text-green-300" />
                          <Chips items={ep.rec_industries} color="bg-emerald-900/60 text-emerald-300" />
                        </div>
                      )}
                      {(ep.unrec_stocks?.length > 0 || ep.unrec_industries?.length > 0) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                          <span className="text-xs text-red-500">📉</span>
                          <Chips items={ep.unrec_stocks} color="bg-red-900/60 text-red-300" />
                          <Chips items={ep.unrec_industries} color="bg-orange-900/60 text-orange-300" />
                        </div>
                      )}
                    </div>
                  )}
                  {ep.analysis_status === "analyzing" && (
                    <p className="text-xs text-yellow-400 mt-1 animate-pulse">分析中…</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {ep.status === "done" && (
                    <Link
                      href={`/episode/${ep.id}`}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium transition-colors"
                    >
                      查看文字稿
                    </Link>
                  )}
                  {(ep.status === "pending" || ep.status === "error") && (
                    <button
                      onClick={() => handleTranscribe(ep.id)}
                      disabled={busy.has(ep.id)}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
                    >
                      {busy.has(ep.id) ? "排程中…" : "開始轉錄"}
                    </button>
                  )}
                  {ep.status === "transcribing" && (
                    <span className="text-xs text-yellow-400 animate-pulse">轉錄中…</span>
                  )}
                  {ep.status === "done" &&
                    (ep.analysis_status === "pending" || ep.analysis_status === "error") && (
                      <button
                        onClick={() => handleAnalyze(ep.id)}
                        disabled={busy.has(ep.id)}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
                      >
                        {busy.has(ep.id) ? "排程中…" : "AI 分析"}
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

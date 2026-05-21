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
    const [h, m, s] = parts;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return `${m}m ${s}s`;
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

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [transcribing, setTranscribing] = useState<Set<number>>(new Set());

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
    setTimeout(() => {
      loadEpisodes();
      setSyncing(false);
    }, 1500);
  }

  async function handleTranscribe(id: number) {
    setTranscribing((prev) => new Set(prev).add(id));
    await fetch(`/api/episodes/${id}/transcribe`, { method: "POST" });
    await loadEpisodes();
    setTranscribing((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const filtered = episodes.filter((ep) =>
    ep.title.toLowerCase().includes(query.toLowerCase())
  );

  const stats = {
    total: episodes.length,
    done: episodes.filter((e) => e.status === "done").length,
    transcribing: episodes.filter((e) => e.status === "transcribing").length,
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-400">股癌 Podcast</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gooaye · 自動轉錄文字稿</p>
          {!loading && (
            <p className="text-xs text-gray-500 mt-1">
              共 {stats.total} 集 · 已完成 {stats.done} 集
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

      {/* Search */}
      <input
        type="text"
        placeholder="搜尋集數標題…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-green-500 mb-4"
      />

      {/* Episode list */}
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
                  {ep.status === "error" && ep.error_msg && (
                    <p className="text-xs text-red-400 mt-1 truncate">{ep.error_msg}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
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
                      disabled={transcribing.has(ep.id)}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
                    >
                      {transcribing.has(ep.id) ? "排程中…" : "開始轉錄"}
                    </button>
                  )}
                  {ep.status === "transcribing" && (
                    <span className="text-xs text-yellow-400 animate-pulse">轉錄中…</span>
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

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Episode {
  id: number;
  title: string;
  pub_date: string;
  duration: string;
  description: string;
  status: "pending" | "transcribing" | "done" | "error";
  error_msg: string | null;
  transcript: string | null;
  updated_at: string | null;
}

function formatDate(raw: string): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return raw;
  }
}

function formatDuration(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) {
    const [h, m] = parts;
    return h > 0 ? `${h} 小時 ${m} 分鐘` : `${m} 分鐘`;
  }
  const secs = Number(raw);
  if (!isNaN(secs)) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h} 小時 ${m} 分鐘` : `${m} 分鐘`;
  }
  return raw;
}

export default function EpisodePage() {
  const { id } = useParams<{ id: string }>();
  const [ep, setEp] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadEpisode = useCallback(async () => {
    try {
      const res = await fetch(`/api/episodes/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setEp(data);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadEpisode();
  }, [loadEpisode]);

  // Poll while transcribing
  useEffect(() => {
    if (!ep || ep.status !== "transcribing") return;
    const interval = setInterval(loadEpisode, 5000);
    return () => clearInterval(interval);
  }, [ep, loadEpisode]);

  async function handleCopy() {
    if (!ep?.transcript) return;
    await navigator.clipboard.writeText(ep.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center py-20 text-gray-500">載入中…</div>
      </main>
    );
  }

  if (!ep) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 mb-6 inline-block">
          ← 返回列表
        </Link>
        <div className="text-center py-20 text-gray-500">找不到此集數</div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 mb-6 inline-block">
        ← 返回列表
      </Link>

      {/* Episode header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-100 leading-snug mb-2">{ep.title}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          {ep.pub_date && <span>{formatDate(ep.pub_date)}</span>}
          {ep.duration && <span>· {formatDuration(ep.duration)}</span>}
        </div>
        {ep.description && (
          <p className="text-sm text-gray-500 mt-3 leading-relaxed line-clamp-3">
            {ep.description}
          </p>
        )}
      </div>

      {/* Transcript area */}
      <div className="border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">文字稿</h2>
          {ep.status === "done" && ep.transcript && (
            <button
              onClick={handleCopy}
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              {copied ? "已複製 ✓" : "複製全文"}
            </button>
          )}
        </div>

        <div className="p-5 bg-gray-900/50">
          {ep.status === "done" && ep.transcript ? (
            <div className="text-[15px] leading-8 text-gray-200 whitespace-pre-wrap break-words">
              {ep.transcript}
            </div>
          ) : ep.status === "transcribing" ? (
            <div className="flex items-center gap-3 py-10 justify-center text-yellow-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm">轉錄中，請稍候…（1-2 小時集數約需 2-5 分鐘）</span>
            </div>
          ) : ep.status === "error" ? (
            <div className="py-8 text-center">
              <p className="text-red-400 text-sm mb-1">轉錄失敗</p>
              {ep.error_msg && <p className="text-gray-500 text-xs">{ep.error_msg}</p>}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 text-sm">
              此集數尚未轉錄，請返回列表點擊「開始轉錄」
            </div>
          )}
        </div>
      </div>

      {/* Char count */}
      {ep.transcript && (
        <p className="text-xs text-gray-600 mt-2 text-right">
          {ep.transcript.length.toLocaleString()} 字
        </p>
      )}
    </main>
  );
}

# 股癌 Podcast 自動轉錄

自動追蹤股癌 Gooaye Podcast，並用 Groq Whisper API 轉成完整文字稿。

## 前置需求

- Python 3.9+
- Node.js 18+
- ffmpeg（用於長集數切割）→ https://ffmpeg.org/download.html
- Groq API Key（免費）→ https://console.groq.com

## 設定

1. 複製 `.env.example` 並填入 Groq Key：
   ```
   cd backend
   copy .env.example .env
   # 編輯 .env，填入 GROQ_API_KEY=gsk_...
   ```

2. 安裝依賴（已完成）：
   ```
   cd backend && pip install -r requirements.txt
   cd frontend && npm install
   ```

## 啟動

```
start.bat
```

- 前端：http://localhost:3000
- 後端 API：http://localhost:8000

## 使用方式

1. 開啟 http://localhost:3000
2. 系統啟動時自動抓取所有集數列表
3. 每小時自動同步新集數並自動開始轉錄最新集
4. 點擊「開始轉錄」可手動觸發任意集數
5. 轉錄完成後點「查看文字稿」

## 注意事項

- Groq 免費額度：每日 7,200 秒音訊 ≈ 2 小時
- 股癌每集約 1-2 小時，每天大約可轉錄 1-2 集
- 長集數會自動切成 10 分鐘段落再轉錄（需要 ffmpeg）
- 轉錄一集約需 2-5 分鐘

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1SHjiqbnAk5Sw91XRHeIOVEQviL2_rgyo

## Run Locally

Prerequisites: Node.js (>=18), npm

1. Install dependencies:
   npm install
2. (Optional) Set `GEMINI_API_KEY` in .env.local if you plan to use Gemini features (currently not required by core quiz app)
3. Start dev server:
   npm run dev
4. Build production:
   npm run build
5. Preview production build:
   npm run preview

### Excel Format
Columns (row 1 header optional):
1. STT (ignored; internal UUID generated)
2. Câu hỏi
3. Đáp án A
4. Đáp án B
5. (Tùy chọn) Đáp án C
6. (Tùy chọn) Đáp án D
7. Đáp án đúng (1-4 hoặc A-D) — số/letter phải nằm trong phạm vi số đáp án thực tế (2–4)
8. Nguồn (optional)
9. Phân loại (optional)

Invalid / incomplete rows are skipped. IDs are generated uniquely; duplicates in STT won't affect the app.

### Tech Improvements
- Local persistence versioned (v1) with schemas per user
- Tailwind via build pipeline (purged)
- Deterministic Fisher-Yates shuffle
- Resumable unfinished attempts after refresh
- Stronger typing for imported Excel questions

### TODO / Next Steps
- Add routing (react-router)
- Add attempt detail view from history
- IndexedDB for large datasets
- Tests for parser & scoring

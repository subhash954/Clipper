# 🎬 ClipStudio AI (VidViral) - Global AI Video SaaS

Turn long-form videos into viral 9:16 Shorts/Reels with **Alex Hormozi & MrBeast style dynamic animated subtitles**, auto-detected viral hooks, and zero server rendering cost.

---

## 🚀 Quick Start (Local Run)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Go to [http://localhost:3000](http://localhost:3000)

4. **Launch the Creator Studio:**
   Click **"Launch Creator Studio"** or visit [http://localhost:3000/studio](http://localhost:3000/studio).
   - Click **"⚡ Try With Instant Sample Video"** to instantly test with high-energy preloaded video, word timestamps, and viral clips.
   - Switch between **Alex Hormozi**, **MrBeast**, **Clean Minimal**, and **Neon Cyber** caption presets.
   - Click **"Export 9:16 Video"** to render and download your vertical short!

---

## 📁 Project Architecture

- `app/page.tsx` — High-converting landing page with social proof, interactive demo, and pricing.
- `app/studio/page.tsx` — Full Creator Studio with 3-column workflow (Viral clips, 9:16 phone mockup, caption styler).
- `components/VideoPreviewPlayer.tsx` — 9:16 vertical viewport with synchronized canvas rendering loop.
- `components/SubtitleStyler.tsx` — Caption controls: presets, font size slider, position, highlight colors, and auto-emoji toggle.
- `components/ViralClipSelector.tsx` — AI-detected high-retention segments ranked by Viral Score (90-99%).
- `components/ExportModal.tsx` — Render pipeline, watermark handling, and 1-click MP4 download.
- `components/PricingModal.tsx` — Monetization engine (Free $0 vs Pro $19/mo vs Agency $49/mo).
- `lib/subtitleRenderer.ts` — High-performance 2D Canvas engine drawing word-by-word bouncing captions.
- `lib/sampleData.ts` — Instant demo videos and speech-to-text timestamps for friction-free onboarding.

---

## 💰 Roadmap to $1,000 – $10,000 / Month

1. **Phase 1: Free Viral Watermark:** Free tier exports include *"Created with ClipStudio.ai"*. When creators post clips on TikTok and Instagram Reels, thousands of viewers discover your tool for free.
2. **Phase 2: Pro Conversion:** Serious creators upgrade to **$19/month** to remove the watermark and unlock 1080p 60FPS.
   - **53 paying users = $1,000 / month**
   - **530 paying users = $10,000 / month**
3. **Phase 3: Creator Affiliate Program:** Offer 30% recurring commission to podcasters and YouTubers to promote your software to their audiences.

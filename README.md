# MiFi Data (Next.js + Supabase)

1. **Supabase**: create a project, run `supabase/schema.sql` in the SQL editor.
2. **Deploy**: push to GitHub, import in Vercel, add the env vars from `.env.example`.
3. **Collector** (on your PC, connected to the MiFi):
   `INGEST_URL=https://YOUR-APP.vercel.app/api/ingest INGEST_KEY=... node collector/collector.js`
4. Open the app on PC / iPad / phone, enter your PIN, set your bundle. Use Share > Add to Home Screen (iOS) or Install (Chrome/Android).

Local dev: `cp .env.example .env.local`, fill it in, `npm install && npm run dev`.

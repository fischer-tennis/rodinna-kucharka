RODINNÁ KUCHÁRKA – VERZIA 1.3 AI CLOUD
======================================

ČO JE NOVÉ
- Pri pridávaní receptu môžeš vybrať 1 až 4 fotografie rukopisu.
- Tlačidlo „Prečítať rukopis a vyplniť recept“ automaticky vyplní názov, kategóriu, autora, suroviny a postup.
- Výsledok sa nikdy neuloží automaticky. Najprv ho skontroluješ a až potom klikneš „Uložiť recept“.
- OpenAI kľúč nie je uložený vo verejnom GitHube; používa ho bezpečná Supabase Edge Function.

A) NAHRAJ APLIKÁCIU NA GITHUB
1. Nahraj obsah ZIPu do repozitára namiesto súčasných súborov.
2. Priečinok „supabase“ môže na GitHube zostať; webovej aplikácii neprekáža.
3. SQL sa tentoraz nespúšťa.

B) VYTVOR SUPABASE EDGE FUNCTION
1. Supabase Dashboard → Edge Functions.
2. Deploy a new function → Via Editor.
3. Názov funkcie musí byť presne: ai-prepis-receptu
4. Zmaž ukážkový kód a vlož obsah súboru:
   supabase/functions/ai-prepis-receptu/index.ts
5. Function deployni so zapnutým overením JWT (predvolené nastavenie). AI prepis tak môže používať iba prihlásený používateľ.

C) PRIDAJ OPENAI KĽÚČ AKO SECRET
1. Vytvor API key v OpenAI Platform a zapni API billing.
2. Supabase Dashboard → Edge Functions → Secrets.
3. Pridaj secret:
   názov: OPENAI_API_KEY
   hodnota: tvoj OpenAI API key
4. Voliteľne môžeš pridať:
   názov: OPENAI_MODEL
   hodnota: gpt-4.1-mini

D) TEST
1. Obnov stránku (PC Ctrl+F5; na mobile aplikáciu zavri a otvor).
2. Info musí ukazovať „Verzia 1.3 AI Cloud“.
3. Prihlás sa → Pridať recept.
4. Vyber fotografiu rukopisu → Prečítať rukopis a vyplniť recept.
5. Skontroluj text a recept ulož.

DÔLEŽITÉ
- OpenAI API je samostatná platená služba; predplatné ChatGPT Plus samo o sebe API kredit neobsahuje.
- Rukopis nemusí byť vždy prečítaný dokonale. Nečitateľné časti AI označí [nečitateľné]. Každý výsledok preto pred uložením skontroluj.
- API key nikdy nevkladaj do app.js, index.html ani na GitHub.

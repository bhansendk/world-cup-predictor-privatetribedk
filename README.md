# ⚽ VM 2026 Forudsigelse – PrivatTribeDK

En React/Vite-webapp til at forudsige VM 2026 i herrefodbold. Alle forudsigelser gemmes centralt via Vercel Blob, så alle kan se stillingen i realtid.

---

## 🗂️ Indhold

- **Hurtig mode** ⚡ – Vælg top 4 + 4 sjove tips
- **Fodboldinteresseret mode** ⭐ – Forudsig hele bracketen + 10 sjove spørgsmål
- **Live stilling** – Opdateres automatisk hver 30. sekund
- **Admin-panel** – Arrangøren registrerer resultater med adgangskode

---

## 🚀 Opsætning (første gang)

### 1. Installér Node.js
Download fra [nodejs.org](https://nodejs.org) (LTS-version anbefales).

### 2. Klon/åbn projektet og installér afhængigheder
```bash
cd vm2026-privattribedk
npm install
```

### 3. Test lokalt
```bash
npm run dev
```
Åbn [http://localhost:5173](http://localhost:5173) i browseren.

---

## 📦 Deploy til Vercel

### 1. Push til GitHub
```bash
git init
git add .
git commit -m "Initial commit – VM 2026 PrivatTribeDK"
```
- Gå til [github.com/new](https://github.com/new) og opret et nyt **privat** repo
- Følg GitHub-instruktionerne for at push til det nye repo

### 2. Opret projekt på Vercel
- Gå til [vercel.com](https://vercel.com) og log ind (gratis konto)
- Klik **"Add New Project"** → importér dit GitHub-repo
- Vercel detekterer automatisk Vite – klik **Deploy**

### 3. Tilføj Environment Variables i Vercel
Gå til **Project Settings → Environment Variables** og tilføj:

| Navn | Værdi | Beskrivelse |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_rw_...` | Token til Vercel Blob storage |
| `ADMIN_PASSWORD` | `<din-hemlige-kode>` | Adgangskode til admin-panel |
| `COMPETITION_SLUG` | `privattribedk` | Unik nøgle for konkurrence-data (adskiller deltagere/resultater) |
| `BLOB_DATA_FILE` | `wc2026-privattribedk.json` | Valgfrit specifikt blob-filnavn (overstyrer slug) |

**Sådan får du `BLOB_READ_WRITE_TOKEN`:**
1. I Vercel: gå til **Storage → Connect Store → Blob**
2. Opret en ny Blob store og vælg dit projekt
3. Token tilføjes automatisk som environment variable

### 4. Redeploy
Efter tilføjelse af env vars: **Deployments → Redeploy** (eller push en ny commit).

Tip: Du kan køre flere konkurrencer med samme `BLOB_READ_WRITE_TOKEN`, så længe hver app har unik `COMPETITION_SLUG` (eller `BLOB_DATA_FILE`).

---

## 👤 Brug som arrangør

1. Åbn siden og vælg **Fodboldinteresseret** eller **Hurtig** mode
2. Udfyld din forudsigelse
3. Gå til **📊 Stilling** og indsend med dit navn
4. Løbende under turneringen: gå til **✅ Resultater**, klik "Åbn admin-panel", indtast din adgangskode og registrér resultater

---

## 👥 Brug for deltagere

1. Del linket til siden (f.eks. `https://vm2026-privattribedk.vercel.app`)
2. Vælg mode, udfyld forudsigelsen
3. Gå til **📊 Stilling** og indsend med dit navn
4. Se stillingen opdatere automatisk!

---

## 🏗️ Teknisk arkitektur

```
vm2026-privattribedk/
├── api/
│   └── data.js          # Vercel serverless API (CRUD via Vercel Blob)
├── src/
│   ├── data/
│   │   ├── wc2026.js    # Grupper, hold, spørgsmål, pointsystem
│   │   └── combo.js     # COMBO-tabel (495 entries) til 3'ere-seeding
│   ├── lib/
│   │   └── scoring.js   # Pointberegning (simpel + avanceret)
│   ├── hooks/
│   │   ├── useLocalState.js   # localStorage-state
│   │   └── useServerData.js   # API-kald + polling
│   ├── components/
│   │   ├── tabs/
│   │   │   ├── Bracket.jsx    # Interaktiv bracket (imperative DOM)
│   │   │   ├── Groups.jsx     # Grupperunde
│   │   │   ├── Third.jsx      # Bedste 3'ere
│   │   │   ├── FunTips.jsx    # Sjove spørgsmål
│   │   │   ├── Konkurrence.jsx # Stilling + indsend
│   │   │   └── Resultater.jsx # Admin-panel
│   │   ├── AdvancedMode.jsx
│   │   ├── SimpleMode.jsx
│   │   ├── ModeSelector.jsx
│   │   └── FormFields.jsx
│   ├── styles/app.css
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

### API-endpoints (`/api/data`)
| Metode | URL | Funktion |
|---|---|---|
| `GET` | `/api/data` | Hent alle forudsigelser + resultater |
| `POST` | `/api/data?action=submit` | Gem/opdater forudsigelse |
| `POST` | `/api/data?action=results` | Gem resultater (kræver admin-password) |
| `DELETE` | `/api/data?name=X&password=Y` | Slet én deltager |
| `DELETE` | `/api/data?action=clearAll&password=Y` | Slet alle deltagere |

---

## 📋 Pointsystem

### Hurtig mode ⚡
| Forudsigelse | Point |
|---|---|
| Mester (top1) | 15 pt |
| Runner-up (top2) | 10 pt |
| Nr. 3 eller 4 (rigtigt semifinalist) | 5 pt |
| Topscorer | 10 pt |
| Gyldne Bold | 10 pt |
| Flest gule kort – hold | 6 pt |
| Flest mål – hold | 8 pt |

### Fodboldinteresseret mode ⭐
| Runde | Point |
|---|---|
| Gruppeplacering for hold der går videre (1/2 eller bedste 3'er) | 1'er=4, 2'er=3, 3'er=2 minus 1 pt pr. placering fejl |
| Korrekt 3'er videre | 2 pt |
| Hold der når R16 | 2 pt |
| Hold der når kvartfinale | 4 pt |
| Hold der når semifinale | 6 pt |
| Hold der når finale | 8 pt |
| Finalist | 6 pt |
| Mester | 15 pt |
| Bronzekamp-vinder | 5 pt |
| + alle sjove tips | se app |

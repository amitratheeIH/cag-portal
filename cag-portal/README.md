# CAG Audit Reports Portal

Next.js 14 frontend for the CAG Audit Report Repository.

## Tech Stack
- **Next.js 14** (App Router, TypeScript)
- **MongoDB Atlas** — catalog, blocks, search
- **Tailwind CSS** — GIGW 3.0 design system
- **Vercel** — deployment

## Local Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your MongoDB URI and GitHub details
```

### 3. Run development server
```bash
npm run dev
# Open http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | Atlas connection string |
| `REDIS_URL` | ❌ | Upstash Redis URL (optional) |
| `GITHUB_OWNER` | ✅ | GitHub username or org |
| `GITHUB_REPO` | ✅ | Data repo name (CAG-Audit-Portal) |
| `GITHUB_BRANCH` | ❌ | Branch (default: main) |
| `GITHUB_TOKEN` | ❌ | Only needed for private repos |

## Deploy to Vercel

### First time
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New Project** → Import `cag-portal` repo
3. Add environment variables (same as `.env.local`)
4. Click **Deploy**

### After that
Every push to `main` auto-deploys.

## Pages

| Route | Description | Status |
|---|---|---|
| `/` | Redirects to `/reports` | ✅ |
| `/reports` | Report listing | ✅ Step 2 |
| `/report/[id]` | Report reader | 🔜 Step 3 |
| `/search` | Full-text search | 🔜 Step 4 |

## API Routes

| Route | Description |
|---|---|
| `GET /api/reports` | List reports with filters |
| `GET /api/reports/[id]` | Single report metadata |
| `GET /api/units/[id]?unit_id=` | Blocks for a unit |
| `GET /api/search?q=` | Atlas Search |

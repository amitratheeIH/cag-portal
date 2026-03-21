// Fetches raw file content from GitHub
// Works for both public repos (no token) and private repos (GITHUB_TOKEN)

const OWNER  = process.env.GITHUB_OWNER!
const REPO   = process.env.GITHUB_REPO!
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const TOKEN  = process.env.GITHUB_TOKEN

function rawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`
}

async function fetchRaw(path: string): Promise<string> {
  const url = rawUrl(path)
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.raw',
  }
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`

  const res = await fetch(url, {
    headers,
    cache: 'no-store' as RequestCache, // always fetch fresh — data changes on push
  })

  if (!res.ok) {
    throw new Error(`GitHub fetch failed: ${res.status} ${url}`)
  }
  return res.text()
}

// ── Fetch a JSON file ────────────────────────────────────────
export async function fetchJson<T = unknown>(path: string): Promise<T> {
  const text = await fetchRaw(path)
  return JSON.parse(text) as T
}

// ── Fetch an NDJSON file → array of objects ──────────────────
export async function fetchNdjson<T = Record<string, unknown>>(path: string): Promise<T[]> {
  const text = await fetchRaw(path)
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as T)
}

// ── Report-specific helpers ───────────────────────────────────

export function reportBasePath(productId: string, folderPath: string): string {
  // folderPath from report_meta e.g. "reports/audit_report/2025/ut/in-dl/AR02-CAG-2025-UT-DL"
  return folderPath
}

export async function fetchStructure(folderPath: string) {
  return fetchJson(`${folderPath}/structure.json`)
}

export async function fetchUnitFile(folderPath: string, unitId: string) {
  return fetchJson(`${folderPath}/units/${unitId}.json`)
}

export async function fetchBlocksNdjson(folderPath: string, stem: string) {
  // stem e.g. "AR02-CAG-2025-UT-DL-CH02"
  return fetchNdjson(`${folderPath}/blocks/content_block_${stem}.ndjson`)
}

export async function fetchDataset(folderPath: string, datasetId: string) {
  return fetchJson(`${folderPath}/datasets/${datasetId}.json`)
}

export async function fetchFootnotes(folderPath: string, unitId: string) {
  try {
    return await fetchJson(`${folderPath}/footnotes/footnotes_${unitId}.json`)
  } catch {
    return null // footnotes are optional
  }
}

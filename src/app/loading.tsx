// src/app/loading.tsx
// Root-level loading UI — shown by Next.js while any page is fetching data.
// Appears instantly on navigation, replaced by page content when ready.

export default function Loading() {
  return (
    <div style={{
      maxWidth:   1100,
      margin:     '0 auto',
      padding:    '40px 20px',
      animation:  'fadeIn .15s ease',
    }}>

      {/* Breadcrumb skeleton */}
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        <Skel w={40} h={10} r={4} />
        <Skel w={6}  h={10} r={4} />
        <Skel w={80} h={10} r={4} />
      </div>

      {/* Page title skeleton */}
      <Skel w={360} h={32} r={6} style={{ marginBottom:10 }} />
      <Skel w={240} h={14} r={4} style={{ marginBottom:32 }} />

      {/* Tab row skeleton */}
      <div style={{ display:'flex', gap:8, marginBottom:28 }}>
        {[80,100,60,120,80].map((w,i) => (
          <Skel key={i} w={w} h={30} r={20} />
        ))}
      </div>

      {/* Two-column layout skeleton */}
      <div style={{ display:'flex', gap:28, alignItems:'flex-start' }}>

        {/* Filters sidebar */}
        <div style={{ width:210, flexShrink:0, display:'flex', flexDirection:'column', gap:16 }}>
          <Skel w={100} h={12} r={4} />
          {[140,120,160,130,100].map((w,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Skel w={12} h={12} r={3} />
              <Skel w={w}  h={12} r={4} />
            </div>
          ))}
        </div>

        {/* Report cards */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{
              padding:'16px 18px', borderRadius:10,
              border:'1px solid var(--rule)', background:'#fff',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ display:'flex', gap:8 }}>
                  <Skel w={90}  h={18} r={10} />
                  <Skel w={110} h={18} r={10} />
                </div>
                <Skel w={60} h={14} r={4} />
              </div>
              <Skel w={'90%' as unknown as number} h={20} r={4} style={{ marginBottom:8 }} />
              <Skel w={'70%' as unknown as number} h={14} r={4} />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position:  400px 0 }
        }
        .skel {
          background: linear-gradient(90deg, #f0f2f5 25%, #e4e8ed 50%, #f0f2f5 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>
    </div>
  )
}

// ── Skeleton block ─────────────────────────────────────────────────────────────
function Skel({ w, h, r = 4, style = {} }: {
  w: number | string; h: number; r?: number; style?: React.CSSProperties
}) {
  return (
    <div className="skel" style={{
      width:        typeof w === 'number' ? w : w,
      height:       h,
      borderRadius: r,
      flexShrink:   0,
      ...style,
    }} />
  )
}

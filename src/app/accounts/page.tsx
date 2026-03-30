import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Accounts Reports — CAG Digital Repository' }

export default function Page() {
  return (
    <main id="main-content" style={{ maxWidth:'900px', margin:'0 auto', padding:'60px 20px' }}>

      {/* Breadcrumb */}
      <div style={{ fontFamily:'system-ui', fontSize:'10px', fontWeight:700, letterSpacing:'1.2px', textTransform:'uppercase', color:'var(--ink3)', marginBottom:'20px', display:'flex', gap:'6px' }}>
        <Link href="/" style={{ color:'var(--ink3)', textDecoration:'none' }}>Home</Link>
        <span>›</span>
        <span>Accounts Reports</span>
      </div>

      <h1 style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'34px', fontWeight:700, color:'var(--navy)', margin:'0 0 12px' }}>
        Accounts Reports
      </h1>
      <p style={{ fontFamily:'system-ui', fontSize:'14px', color:'var(--ink3)', margin:'0 0 40px', lineHeight:1.6 }}>
        Reports of the Comptroller on accounts of Union and State governments
      </p>

      <div style={{
        background:'#fff', border:'2px dashed var(--rule)',
        borderRadius:'12px', padding:'60px 20px', textAlign:'center',
      }}>
        <div style={{ fontSize:'40px', marginBottom:'16px' }}>🔜</div>
        <div style={{ fontFamily:'"EB Garamond","Times New Roman",serif', fontSize:'20px', fontWeight:700, color:'var(--navy)', marginBottom:'10px' }}>
          Coming Soon
        </div>
        <p style={{ fontFamily:'system-ui', fontSize:'13px', color:'var(--ink3)', margin:'0 0 24px', maxWidth:'400px', marginLeft:'auto', marginRight:'auto' }}>
          This section is under development. Accounts Reports will be available here once the ingest pipeline is extended to cover this report category.
        </p>
        <Link href="/" style={{
          display:'inline-flex', alignItems:'center', gap:'7px',
          fontFamily:'system-ui', fontSize:'13px', fontWeight:700,
          color:'var(--navy)', background:'var(--navy-lt)',
          padding:'9px 20px', borderRadius:'22px', textDecoration:'none',
          border:'1px solid rgba(26,58,107,.2)',
        }}>
          ← Back to home
        </Link>
      </div>

    </main>
  )
}

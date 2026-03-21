import Link from 'next/link'

export default function Home() {
  return (
    <main id="main-content" style={{minHeight:'80vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 24px'}}>
      <div style={{textAlign:'center',maxWidth:'560px'}}>
        <div style={{fontSize:'48px',marginBottom:'16px'}}>📋</div>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',fontWeight:700,color:'#1a3a6b',marginBottom:'12px'}}>
          CAG Audit Reports Portal
        </h1>
        <p style={{fontFamily:'system-ui',fontSize:'15px',color:'#666',marginBottom:'32px',lineHeight:1.6}}>
          Audit Reports of the Comptroller and Auditor General of India
        </p>
        <Link href="/reports" style={{
          display:'inline-block',
          background:'#1a3a6b',color:'#fff',
          padding:'12px 32px',borderRadius:'6px',
          fontFamily:'system-ui',fontSize:'15px',fontWeight:600,
          textDecoration:'none',
        }}>
          Browse Reports
        </Link>
      </div>
    </main>
  )
}

import type { Metadata } from 'next'
import HomePage from '@/components/home/HomePage'

export const metadata: Metadata = {
  title: 'CAG Digital Repository',
  description: 'Digital Repository of Audit Reports — Comptroller and Auditor General of India',
}

export default function Page() {
  return <HomePage />
}

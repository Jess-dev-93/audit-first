import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: { absolute: 'AuditUnfold | Website audit workspace' },
  description: 'Scan a website, review the evidence and prepare an editable Report preview.',
}

export default function AuditLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Bottom sheet rendered at the document root so it always paints above the fixed NOW layout and the tab bar. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">{children}</div>
    </>,
    document.body,
  )
}

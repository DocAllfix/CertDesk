/**
 * NotificaToast — helper per mostrare toast sonner per tipo notifica.
 * Usato da useNotifiche quando arriva una nuova notifica real-time.
 *
 * critical  → toast.error   (rosso)
 * warning   → toast.warning (giallo)
 * richiesta → toast         (custom icon 📋)
 * success   → toast.success (verde)
 * info/sistema → silenzioso
 */
import { toast } from 'sonner'
import type { NotificaTipo } from '@/types/app.types'

interface ToastPayload {
  titolo:   string
  messaggio: string
  tipo:     NotificaTipo
}

export function showNotificaToast({ titolo, messaggio, tipo }: ToastPayload): void {
  const opts = { description: messaggio }
  switch (tipo) {
    case 'critical':  toast.error(titolo,   opts);                       break
    case 'richiesta': toast(titolo,          { ...opts, icon: '📋' });   break
    case 'warning':   toast.warning(titolo,  opts);                       break
    case 'success':   toast.success(titolo,  opts);                       break
    default:          break  // 'info' e 'sistema' silenziosi
  }
}

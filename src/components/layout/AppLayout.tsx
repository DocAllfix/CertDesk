/**
 * AppLayout — wrapper principale dell'app autenticata.
 * Ref: ../evalisdesk-ref/src/components/layout/AppLayout.jsx
 *
 * Struttura:
 *   Sidebar (fixed left-0, w-255px o w-56px)
 *   Main content (pl dinamico basato su collapsed)
 *     Header (sticky top-0)
 *     <Outlet />
 *   NotifichePanel (slide-over da destra, z-50)
 */
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar }             from './Sidebar'
import { Header }              from './Header'
import { NotifichePanel }           from '@/components/notifiche'
import { useNotificheSubscription } from '@/hooks/useNotifiche'

export function AppLayout() {
  const [collapsed,          setCollapsed]          = useState(false)
  const [notificationsOpen,  setNotificationsOpen]  = useState(false)

  // Subscription unica per tutta l'app (canale Realtime + heartbeat + polling)
  useNotificheSubscription()

  const handleToggle             = () => setCollapsed(p => !p)
  const handleOpenNotifications  = () => setNotificationsOpen(true)
  const handleCloseNotifications = () => setNotificationsOpen(false)

  return (
    <div className="min-h-screen bg-background flex">

      <Sidebar
        collapsed={collapsed}
        onToggle={handleToggle}
        onOpenNotifications={handleOpenNotifications}
      />

      {/* Main content — offset dinamico in base al collapsed */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{
          paddingLeft: collapsed ? '56px' : '255px',
          width: '100%',
        }}
      >
        <Header onOpenNotifications={handleOpenNotifications} />

        <main className="flex-1 p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <NotifichePanel
        open={notificationsOpen}
        onClose={handleCloseNotifications}
      />
    </div>
  )
}

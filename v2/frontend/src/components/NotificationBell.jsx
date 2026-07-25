import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import './NotificationBell.css'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ items: [], unread: 0 })
  const [error, setError] = useState('')
  const root = useRef(null)

  async function load() {
    try {
      setData(await api('/auth/notifications'))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 30000)
    const close = (event) => { if (root.current && !root.current.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => { window.clearInterval(timer); document.removeEventListener('mousedown', close) }
  }, [])

  async function markRead(item) {
    if (!item.is_read) {
      await api(`/auth/notifications/${item.id}/read`, { method: 'POST' })
      await load()
    }
  }

  async function markAll() {
    await api('/auth/notifications/read-all', { method: 'POST' })
    await load()
  }

  return <div className="notificationCenter" ref={root}>
    <button className="notificationBell" onClick={() => { setOpen(!open); if (!open) load() }} aria-label="Notifications">
      <span>🔔</span>{data.unread > 0 && <b>{data.unread > 99 ? '99+' : data.unread}</b>}
    </button>
    {open && <div className="notificationPanel">
      <div className="notificationHeader"><div><strong>Notifications</strong><span>{data.unread} unread</span></div>{data.unread > 0 && <button onClick={markAll}>Mark all read</button>}</div>
      {error && <div className="notificationError">{error}</div>}
      <div className="notificationList">
        {data.items.map((item) => <button key={item.id} className={`notificationItem ${item.is_read ? '' : 'unread'}`} onClick={() => markRead(item)}>
          <span className={`notificationDot ${item.kind}`} />
          <span><strong>{item.title}</strong><small>{item.message}</small><time>{new Date(item.created_at).toLocaleString()}</time></span>
        </button>)}
        {!data.items.length && !error && <div className="notificationEmpty">No notifications yet.</div>}
      </div>
    </div>}
  </div>
}

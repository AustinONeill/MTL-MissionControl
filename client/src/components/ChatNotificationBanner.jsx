import { useChatStore } from '../store/chatStore'

export default function ChatNotificationBanner({ onOpenChat }) {
  const { notifBanner, dismissBanner, setActiveConv } = useChatStore()

  if (!notifBanner) return null

  const handleClick = () => {
    setActiveConv(notifBanner.convId)
    dismissBanner()
    onOpenChat?.()
  }

  return (
    <div className="chat-notif-banner" role="alert" onClick={handleClick}>
      <div className="chat-notif-inner">
        <span className="chat-notif-chan">{notifBanner.convName}</span>
        <span className="chat-notif-sender">{notifBanner.senderName}</span>
        <span className="chat-notif-content">{notifBanner.content}</span>
      </div>
      <button
        className="chat-notif-dismiss"
        onClick={e => { e.stopPropagation(); dismissBanner() }}
        aria-label="Dismiss"
      >✕</button>
    </div>
  )
}

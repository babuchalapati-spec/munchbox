import {useEffect, useRef, useState} from 'react';
import {useParams, useSearchParams, useNavigate} from 'react-router-dom';
import client from '../api/client';
import {useAuth} from '../context/AuthContext';

export default function Chat() {
  const {id} = useParams();
  const [searchParams] = useSearchParams();
  const channel = searchParams.get('channel') === 'pickup' ? 'pickup' : 'customer';
  const title = searchParams.get('title') || 'Chat';
  const navigate = useNavigate();
  const {user} = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  async function load() {
    const {data} = await client.get(`/orders/${id}/messages`, {params: {channel}});
    setMessages(data.messages);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, channel]);

  useEffect(() => {
    listRef.current?.scrollTo({top: listRef.current.scrollHeight});
  }, [messages]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    try {
      const {data} = await client.post(`/orders/${id}/messages`, {text: trimmed, channel});
      setMessages((prev) => [...prev, data.chatMessage]);
    } catch (err) {
      setText(trimmed);
    }
  }

  if (loading) return <div className="screen page-pad">Loading…</div>;

  return (
    <div className="screen" style={{display: 'flex', flexDirection: 'column', height: '100vh'}}>
      <div className="top-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{title}</h2>
      </div>
      <div ref={listRef} style={{flex: 1, overflowY: 'auto', padding: 12}}>
        {messages.length === 0 && <p className="muted" style={{textAlign: 'center', marginTop: 24}}>No messages yet.</p>}
        {messages.map((m) => {
          const isMine = m.sender?._id === user?.id;
          return (
            <div key={m._id} style={{display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 8}}>
              <div style={{
                maxWidth: '78%', borderRadius: 12, padding: '8px 12px',
                background: isMine ? '#c2185b' : '#fff',
                color: isMine ? '#fff' : '#2a2118',
                border: isMine ? 'none' : '1px solid #e6e0da',
              }}>
                {!isMine && <div style={{fontSize: 11, fontWeight: 700, color: '#c2185b', marginBottom: 2}}>{m.sender?.name}</div>}
                <div>{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #e6e0da', background: '#fff'}}>
        <input
          className="input"
          style={{marginBottom: 0, flex: 1}}
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn" style={{width: 'auto', flex: '0 0 auto', padding: '0 16px'}} onClick={send}>Send</button>
      </div>
    </div>
  );
}

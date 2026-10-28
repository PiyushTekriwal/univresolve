import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Loader2, MinusCircle } from 'lucide-react';

/* ─── constants ──────────────────────────────────────────────────────────── */

const CHAT_ENDPOINT = '/ragchat/chat';

const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  text: "👋 Hi! I'm the UNIV-Resolve assistant. Ask me anything about campus policies, hostel rules, or how to use this platform.",
};

/* ─── tiny helpers ───────────────────────────────────────────────────────── */

const uid = () => Math.random().toString(36).slice(2);

/* ─── sub-components ─────────────────────────────────────────────────────── */

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs
          ${isUser ? 'bg-primary-600' : 'bg-slate-700'}`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* bubble */}
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm
          ${isUser
            ? 'bg-primary-600 text-white rounded-br-sm'
            : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'
          }`}
      >
        {msg.loading
          ? <Loader2 size={16} className="animate-spin text-slate-400" />
          : msg.text}
      </div>
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────────────── */

export default function ChatBot() {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);

  // Smart-shift: how many px to shift left when something is in the way
  const [shiftLeft, setShiftLeft]   = useState(false);
  const buttonRef   = useRef(null);
  const endRef      = useRef(null);
  const inputRef    = useRef(null);

  /* ── auto-scroll to latest message ── */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── focus input when panel opens ── */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  /* ── smart-shift: detect overlapping elements ────────────────────────── */
  const checkOverlap = useCallback(() => {
    if (!buttonRef.current) return;
    const btn = buttonRef.current.getBoundingClientRect();

    // Collect all fixed/absolute elements on the page except the chatbot itself
    const candidates = Array.from(
      document.querySelectorAll(
        '[role="alert"], [role="status"], .toast, .snackbar, [data-toast], [data-notification]'
      )
    );

    const overlaps = candidates.some((el) => {
      if (buttonRef.current?.contains(el) || el.contains(buttonRef.current)) return false;
      const r = el.getBoundingClientRect();
      return !(r.right < btn.left || r.left > btn.right ||
               r.bottom < btn.top  || r.top  > btn.bottom);
    });

    setShiftLeft(overlaps);
  }, []);

  useEffect(() => {
    const id = setInterval(checkOverlap, 800);
    return () => clearInterval(id);
  }, [checkOverlap]);

  /* ── send message ─────────────────────────────────────────────────────── */
  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg = { id: uid(), role: 'user', text: question };
    const loadMsg = { id: uid(), role: 'assistant', text: '', loading: true };

    setMessages((prev) => [...prev, userMsg, loadMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server error: ${res.status}`);
      }
      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadMsg.id ? { ...m, text: data.answer, loading: false } : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadMsg.id
            ? { ...m, text: err.message ? `⚠️ ${err.message}` : "⚠️ Couldn't reach the assistant. Please try again later.", loading: false }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ─── render ─────────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Chat Panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="fixed bottom-24 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            style={{ height: '520px' }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary-700 text-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">UNIV Assistant</p>
                  <p className="text-xs text-primary-200 leading-tight">Powered by Gemini</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMessages([WELCOME_MSG])}
                  title="Clear chat"
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <MinusCircle size={16} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  title="Close"
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50">
              {messages.map((msg) => (
                <Bubble key={msg.id} msg={msg} />
              ))}
              <div ref={endRef} />
            </div>

            {/* input area */}
            <div className="px-3 py-3 bg-white border-t border-slate-100 flex-shrink-0">
              <div className="flex items-end gap-2 bg-slate-100 rounded-xl px-3 py-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // auto-grow up to ~4 lines
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
                  }}
                  onKeyDown={handleKey}
                  placeholder="Ask a question…"
                  className="flex-1 resize-none bg-transparent text-sm text-slate-800 outline-none placeholder-slate-400"
                  style={{ maxHeight: '96px', overflowY: 'auto' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center
                             hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Send size={15} />
                  }
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-400 mt-1.5">
                Answers are based on university documents only
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Button ───────────────────────────────────────────── */}
      <motion.button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Close assistant' : 'Open assistant'}
        animate={{ x: shiftLeft ? -72 : 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{  scale: 0.94 }}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full
                   bg-primary-600 text-white shadow-lg shadow-primary-600/40
                   flex items-center justify-center
                   hover:bg-primary-700 transition-colors focus:outline-none
                   focus-visible:ring-4 focus-visible:ring-primary-400"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0,   opacity: 1 }}
              exit={{    rotate:  90,  opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90,  opacity: 0 }}
              animate={{ rotate: 0,   opacity: 1 }}
              exit={{    rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <MessageCircle size={22} />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Pulse ring — draws attention when panel is closed */}
        {!open && (
          <span className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-30 pointer-events-none" />
        )}
      </motion.button>
    </>
  );
}

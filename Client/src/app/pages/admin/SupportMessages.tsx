import { useState, useEffect } from "react";
import { MessageCircle, ChevronDown, ChevronUp, Send, CheckCircle, Clock, X } from "lucide-react";
import api from "../../../services/api";

interface Reply {
  message: string;
  sentAt: string;
}

interface SupportMsg {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "open" | "replied" | "closed";
  replies: Reply[];
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-700 border-yellow-200",
  replied: "bg-green-100 text-green-700 border-green-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function SupportMessages() {
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    api.get("/support").then((res) => {
      setMessages(res.data.messages);
    }).finally(() => setIsLoading(false));
  }, []);

  const handleReply = async (id: string, email: string, name: string) => {
    const reply = replyText[id]?.trim();
    if (!reply) return;
    setSending(id);
    try {
      await api.post(`/support/${id}/reply`, { reply });
      setMessages((prev) =>
        prev.map((m) =>
          m._id === id
            ? { ...m, status: "replied", replies: [...m.replies, { message: reply, sentAt: new Date().toISOString() }] }
            : m
        )
      );
      setReplyText((prev) => ({ ...prev, [id]: "" }));
    } catch {
      alert("Failed to send reply.");
    } finally {
      setSending(null);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await api.put(`/support/${id}/status`, { status });
    setMessages((prev) => prev.map((m) => m._id === id ? { ...m, status: status as SupportMsg["status"] } : m));
  };

  const filtered = filterStatus === "all" ? messages : messages.filter((m) => m.status === filterStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Support Messages</h1>
        <p className="text-muted-foreground">View and respond to customer support enquiries</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border p-4 flex gap-3 flex-wrap">
        {["all", "open", "replied", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize border transition-colors ${
              filterStatus === s
                ? "bg-primary text-white border-primary"
                : "bg-white text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {s === "all" ? `All (${messages.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${messages.filter((m) => m.status === s).length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading messages…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-border">
          <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">No messages found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((msg) => (
            <div key={msg._id} className="bg-white rounded-xl border border-border overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => setExpanded(expanded === msg._id ? null : msg._id)}
                className="w-full flex items-start gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-bold text-sm">
                  {msg.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{msg.name}</span>
                    <span className="text-xs text-muted-foreground">{msg.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[msg.status]}`}>
                      {msg.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-0.5 truncate">{msg.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{msg.message}</p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(msg.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  {expanded === msg._id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded view */}
              {expanded === msg._id && (
                <div className="border-t border-border px-4 py-4 space-y-4">
                  {/* Original message */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Original Message</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
                  </div>

                  {/* Previous replies */}
                  {msg.replies.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Previous Replies</p>
                      {msg.replies.map((r, i) => (
                        <div key={i} className="bg-green-50 border border-green-100 rounded-lg p-3">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{r.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(r.sentAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply form */}
                  {msg.status !== "closed" && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Send Reply to {msg.email}</p>
                      <textarea
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        placeholder="Type your reply…"
                        value={replyText[msg._id] || ""}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [msg._id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReply(msg._id, msg.email, msg.name)}
                          disabled={!replyText[msg._id]?.trim() || sending === msg._id}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          {sending === msg._id ? "Sending…" : "Send Reply"}
                        </button>
                        <button
                          onClick={() => handleStatusChange(msg._id, "closed")}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Close Ticket
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.status === "closed" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-slate-50 rounded-lg p-3">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      This ticket is closed.
                      <button
                        onClick={() => handleStatusChange(msg._id, "open")}
                        className="ml-auto text-primary text-xs font-medium hover:underline"
                      >
                        Reopen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

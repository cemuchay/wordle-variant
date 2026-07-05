import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, CheckCheck, Check } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { ProtectedAvatar } from "../ProtectedAvatar";

interface MessageInfoModalProps {
  msg: {
    id: string;
    created_at: string;
    group_id: string;
    user_id: string;
  };
  currentUserId: string;
  onClose: () => void;
}

interface MemberReceipt {
  userId: string;
  username: string;
  avatarUrl: string;
  readAt: string | null; // null if unread
  isMe: boolean;
}

export function MessageInfoModal({ msg, currentUserId, onClose }: MessageInfoModalProps) {
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<MemberReceipt[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadReceiptsData = async () => {
      try {
        // 1. Fetch group members
        const { data: members, error: membersErr } = await supabase
          .from("chat_group_members")
          .select("user_id, profiles(username, avatar_url)")
          .eq("group_id", msg.group_id)
          .eq("status", "joined");

        if (membersErr) throw membersErr;

        // 2. Fetch read receipts
        const { data: readReceipts, error: receiptsErr } = await supabase
          .from("chat_read_receipts")
          .select("user_id, last_seen_at")
          .eq("group_id", msg.group_id);

        if (receiptsErr) throw receiptsErr;

        if (!isMounted) return;

        const msgTime = new Date(msg.created_at).getTime();
        const mapped: MemberReceipt[] = (members || [])
          .filter((m) => m.user_id !== msg.user_id) // Exclude the sender of the message
          .map((m) => {
            const receipt = readReceipts?.find((r) => r.user_id === m.user_id);
            const readAt =
              receipt && new Date(receipt.last_seen_at).getTime() >= msgTime
                ? receipt.last_seen_at
                : null;

            const profileObj = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;

            return {
              userId: m.user_id,
              username: profileObj?.username || "Someone",
              avatarUrl: profileObj?.avatar_url || "",
              readAt,
              isMe: m.user_id === currentUserId,
            };
          });

        // Sort: Read first (by read time descending), then Unread
        mapped.sort((a, b) => {
          if (a.readAt && !b.readAt) return -1;
          if (!a.readAt && b.readAt) return 1;
          if (a.readAt && b.readAt) {
            return new Date(b.readAt).getTime() - new Date(a.readAt).getTime();
          }
          return a.username.localeCompare(b.username);
        });

        setReceipts(mapped);
      } catch (err) {
        console.error("Failed to load read receipts info:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadReceiptsData();

    return () => {
      isMounted = false;
    };
  }, [msg, currentUserId]);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xs"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[#1f2c34] border border-white/10 rounded-3xl shadow-2xl p-5 max-w-[320px] w-full flex flex-col max-h-[70dvh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-white/5 shrink-0">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Message Info</h3>
            <p className="text-[9px] font-bold text-white/40 uppercase mt-0.5">
              Sent at {formatTime(msg.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 border border-white/5 rounded-full text-white/60 hover:text-white cursor-pointer transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Info Content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 scrollbar-hide min-h-0 mt-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-8 h-8 border-3 border-correct border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Loading Receipts...</span>
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-6 text-xs text-white/40 italic">
              No other group members.
            </div>
          ) : (
            <div className="space-y-2">
              {receipts.map((r) => (
                <div
                  key={r.userId}
                  className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-2xl"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ProtectedAvatar
                      userId={r.userId}
                      src={r.avatarUrl}
                      username={r.username}
                      className="w-7 h-7 rounded-full border border-white/10 shrink-0"
                    />
                    <span className="text-xs font-bold text-white truncate">
                      {r.isMe ? "You" : r.username}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-right">
                    {r.readAt ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-correct flex items-center gap-1">
                          <CheckCheck size={12} className="text-correct" /> Read
                        </span>
                        <span className="text-[8px] font-semibold text-white/50 font-mono mt-0.5">
                          {formatDate(r.readAt)} {formatTime(r.readAt)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-white/40 flex items-center gap-1">
                          <Check size={12} className="text-white/30" /> Sent
                        </span>
                        <span className="text-[8px] font-semibold text-white/30 uppercase mt-0.5">
                          Delivered
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

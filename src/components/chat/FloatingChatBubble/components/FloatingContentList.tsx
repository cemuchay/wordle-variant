/* eslint-disable @typescript-eslint/no-explicit-any */
import { motion, AnimatePresence } from "framer-motion";
import { Search, MessageCircle, Users, ShieldAlert, CheckCheck, Check, X, Reply, Smile, Edit2, Trash2 } from "lucide-react";
import { ChatImage } from "../../ChatMessage/ChatImage";
import { ConnectedAudioPlayer } from "../../ChatMessage/ConnectedAudioPlayer";
import { ReactionBadge } from "../../ChatMessage/ReactionBadge";
import { ReactionPicker } from "../../ChatMessage/ReactionPicker";
import { ProtectedAvatar } from "../../ProtectedAvatar";
import { VoiceControlBar } from "../../VoiceControlBar";
import { CORE_GROUPS } from "./commons";

const FloatingContentList = ({ selectedGroupId, conversationSearchQuery, scrollRef, handleScroll, setConversationSearchQuery, filteredConversations, setSelectedGroupId, getDecryptedContent, hasPlayedToday, hasMoreMessages, handleExpand, allRoomMessages, activeRoomMessages, user, editingMessageId, handleMarkAsRead, handleTouchStart, handleTouchEnd, handleTouchMove, reactingModalMessageId, reactingMessageId, visibleUnreadId, showUnreadLine, setReactingMessageId, handleReact, reactionsRef, copyToClipboard, setEditingMessageId, setEditText, handleDeleteMessage, showReactionDetailsId, detailsRef, getUserName, editText, handleEditSave, handleSwipeToReply, handleReply, setShowReactionDetailsId }: any) => {

    return (
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 min-h-0 scrollbar-hide h-full" ref={scrollRef} onScroll={handleScroll}>
            {!selectedGroupId ? (
                /* Screen A: Conversation List */
                <div className="space-y-1.5">
                    {/* Search input */}
                    <div className="relative mb-2">
                        <input
                            type="text"
                            value={conversationSearchQuery}
                            onChange={(e) => setConversationSearchQuery(e.target.value)}
                            placeholder="Search conversations..."
                            className="w-full bg-gray-800/90 border border-gray-700/60 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-gray-400 outline-none focus:border-indigo-500 transition-all"
                        />
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                    {filteredConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12">
                            <MessageCircle className="w-8 h-8 text-gray-600 mb-2" />
                            <p className="text-xs text-gray-500">
                                {conversationSearchQuery ? "No matching conversations" : "No conversations yet"}
                            </p>
                        </div>
                    ) : (
                        filteredConversations.map(({ group, lastMessage, unreadCount }: any) => {
                            const name = group?.name || CORE_GROUPS[group.id] || "Room";
                            const isCore = CORE_GROUPS[group.id] !== undefined;
                            const isDM = group?.type === "dm" && !!group?.dm_partner?.avatar_url;
                            return (
                                <button
                                    key={group.id}
                                    onClick={() => { setSelectedGroupId(group.id); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800 border border-gray-800 hover:border-gray-700/60 transition-all cursor-pointer text-left"
                                >
                                    {isDM ? (
                                        <ProtectedAvatar
                                            userId={group.dm_partner!.id}
                                            src={group.dm_partner!.avatar_url}
                                            username={name}
                                            className="w-10 h-10 rounded-full border border-white/10 bg-slate-900 shrink-0"
                                        />
                                    ) : isCore ? (
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-correct text-black font-black shrink-0 text-sm">
                                            #
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-white shrink-0">
                                            <Users size={18} />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase text-indigo-400 tracking-wide truncate">
                                                {name}
                                            </span>
                                            {unreadCount > 0 && (
                                                <span className="bg-rose-500/25 border border-rose-500/20 text-rose-300 text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                                    {unreadCount} unread
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-400 truncate mt-1">
                                            {lastMessage.profiles ? `${lastMessage.profiles.username}: ` : ""}
                                            {lastMessage.voice_url ? (
                                                <span className="text-indigo-400 font-semibold">🎤 Voice note</span>
                                            ) : lastMessage.image_url ? (
                                                <span className="text-indigo-400 font-semibold">📷 Image</span>
                                            ) : (
                                                getDecryptedContent(lastMessage)
                                            )}
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            ) : selectedGroupId === "00000000-0000-0000-0000-000000000002" && !hasPlayedToday ? (
                /* Locked Game Analysis placeholder */
                <div className="flex flex-col items-center justify-center h-full py-12 text-center px-6">
                    <ShieldAlert className="w-10 h-10 text-red-400 mb-3" />
                    <h4 className="text-sm font-black uppercase text-white tracking-tight mb-1">Analysis Room Locked</h4>
                    <p className="text-xs text-white/50 max-w-60 leading-relaxed">
                        Complete today's daily puzzle to unlock this discussion.
                    </p>
                </div>
            ) : (
                (
                    <div className="space-y-4">
                        <VoiceControlBar />
                        {hasMoreMessages && (
                            <div className="flex flex-col items-center gap-2 pb-2">
                                <button onClick={handleExpand} className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1 rounded-full transition-colors cursor-pointer">
                                    {allRoomMessages.length - 20}+ older · View full chat
                                </button>
                                <div className="h-px w-full bg-white/10" />
                            </div>
                        )}
                        {activeRoomMessages.map((msg: any) => {
                            const isMe = msg.user_id === user?.id;
                            const isEditing = editingMessageId === msg.id;
                            const content = getDecryptedContent(msg);

                            return (
                                <div
                                    key={msg.id}
                                    onMouseEnter={() => !isMe && !msg.is_read && handleMarkAsRead(msg.id)}
                                    onTouchStart={() => handleTouchStart(msg.id)}
                                    onTouchEnd={handleTouchEnd}
                                    onTouchMove={handleTouchMove}
                                    onTouchCancel={handleTouchEnd}
                                    className={`relative ${reactingMessageId === msg.id || reactingModalMessageId === msg.id ? 'z-50' : 'z-auto'} overflow-visible`}
                                >
                                    {/* Unread divider */}
                                    {msg.id === visibleUnreadId && showUnreadLine && (
                                        <motion.div
                                            id="fb-unread-line"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex items-center my-4 gap-3 px-2"
                                        >
                                            <div className="h-px flex-1 bg-white/20" />
                                            <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] bg-white/10 px-3 py-1 rounded-full border border-white/20 shadow-[0_0_12px_rgba(255,255,255,0.08)]">
                                                Unread Messages
                                            </span>
                                            <div className="h-px flex-1 bg-white/20" />
                                        </motion.div>
                                    )}
                                    {/* Reaction Picker */}
                                    <AnimatePresence>
                                        {reactingMessageId === msg.id && (
                                            <>
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    onClick={() => setReactingMessageId(null)}
                                                    className="fixed inset-0 bg-black/20 z-40"
                                                />
                                                <ReactionPicker
                                                    ref={reactionsRef}
                                                    isMe={isMe}
                                                    onReact={(emoji) => handleReact(msg.id, emoji)}
                                                    currentReaction={user?.id ? msg.reactions?.[user.id] : undefined}
                                                    onCopy={() => {
                                                        copyToClipboard(content);
                                                        setReactingMessageId(null);
                                                    }}
                                                    onEdit={isMe && !msg.voice_url && !msg.image_url ? () => { setEditingMessageId(msg.id); setEditText(content); setReactingMessageId(null); } : undefined}
                                                    onDelete={isMe ? () => { handleDeleteMessage(msg.id); setReactingMessageId(null); } : undefined}
                                                />
                                            </>
                                        )}
                                    </AnimatePresence>

                                    {/* Reaction Details */}
                                    <AnimatePresence>
                                        {showReactionDetailsId === msg.id && msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                            <motion.div
                                                ref={detailsRef}
                                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                                className={`absolute bottom-full mb-2 ${isMe ? 'left-0' : 'right-0'} bg-slate-900 border border-white/15 rounded-2xl p-2 shadow-2xl z-50 min-w-[140px] max-w-[200px]`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    {Object.entries(msg.reactions).map(([uid, emoji]) => (
                                                        <div key={uid} className="flex items-center justify-between gap-3 px-2 py-1 hover:bg-white/5 rounded-lg transition-colors">
                                                            <span className="text-[10px] font-black text-white truncate">
                                                                {getUserName(uid)}
                                                            </span>
                                                            <span className="text-[12px] shrink-0">{emoji as string}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                                        <ProtectedAvatar
                                            userId={msg.user_id}
                                            src={msg.profiles?.avatar_url}
                                            username={msg.profiles?.username}
                                            className="w-8 h-8 rounded-full border border-white/10 bg-slate-900 shrink-0"
                                        />
                                        <div className={`min-w-0 max-w-[75%] ${isMe ? "items-end" : ""}`}>
                                            <div className="flex items-baseline gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                                                    {msg.profiles?.username || "User"}
                                                </span>
                                                <span className="text-[8px] text-gray-500 inline-flex items-center gap-1">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {isMe && !msg.is_deleted && (
                                                        msg.status === "sending" ? (
                                                            <span className="animate-spin text-white/50 text-[8px]">⌛</span>
                                                        ) : msg.status === "failed" ? (
                                                            <span className="text-red-400 text-[8px] font-black">⚠️</span>
                                                        ) : (
                                                            <CheckCheck size={10} className={msg.is_read ? "text-blue-400" : "text-white/30"} />
                                                        )
                                                    )}
                                                </span>
                                            </div>

                                            {isEditing ? (
                                                <div className="mt-1 flex items-center gap-1.5">
                                                    <input
                                                        type="text"
                                                        value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") handleEditSave(msg.id);
                                                            else if (e.key === "Escape") setEditingMessageId(null);
                                                        }}
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
                                                    />
                                                    <button
                                                        onClick={() => handleEditSave(msg.id)}
                                                        className="bg-indigo-600 hover:bg-indigo-500 p-1.5 rounded-lg text-white cursor-pointer"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingMessageId(null)}
                                                        className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg text-gray-400 cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="relative group/msg pb-2 sm:pb-4">
                                                    {/* Reply preview */}
                                                    {msg.reply_to && !msg.is_deleted && (() => {
                                                        const replyToMsg = allRoomMessages.find((m: any) => m.id === msg.reply_to);
                                                        if (!replyToMsg) return null;
                                                        return (
                                                            <div className={`flex items-center gap-2 mb-1.5 text-[10px] text-white/60 bg-white/5 border-l-2 border-correct/40 px-3 py-1.5 rounded-t-xl max-w-[85%] ${isMe ? 'flex-row-reverse ml-auto' : ''}`}>
                                                                <Reply size={10} className="text-correct shrink-0" />
                                                                <span className="truncate text-gray-400">
                                                                    {replyToMsg.profiles?.username || 'User'}: {replyToMsg.voice_url ? '🎤 Voice note' : replyToMsg.image_url ? '📷 Image' : getDecryptedContent(replyToMsg)}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                    {msg.voice_url ? (
                                                        <ConnectedAudioPlayer
                                                            url={msg.voice_url}
                                                            messageId={msg.id}
                                                            allMessageIds={activeRoomMessages.map((m: any) => m.id)}
                                                            allMessages={activeRoomMessages}
                                                            userId={user?.id || ""}
                                                        />
                                                    ) : msg.image_url ? (
                                                        <ChatImage url={msg.image_url} />
                                                    ) : (
                                                        <motion.div
                                                            drag={!msg.is_deleted && !isEditing ? "x" : false}
                                                            dragDirectionLock
                                                            dragConstraints={{ left: 0, right: 0 }}
                                                            dragSnapToOrigin
                                                            dragElastic={{ left: 0, right: 0.6 }}
                                                            onDragEnd={(_, info) => {
                                                                if (info.offset.x > 50) {
                                                                    handleSwipeToReply(msg);
                                                                }
                                                            }}
                                                        >
                                                            <p className={`text-xs text-left text-gray-200 mt-1 leading-relaxed whitespace-pre-wrap wrap-break-word px-3 py-2 rounded-2xl ${isMe ? 'bg-indigo-500/15 border-indigo-500/25' : 'bg-white/5 border border-white/5'}`}>
                                                                {getDecryptedContent(msg)}
                                                                {msg.is_edited && (
                                                                    <span className="text-[8px] text-gray-500 ml-1">(edited)</span>
                                                                )}
                                                            </p>
                                                        </motion.div>
                                                    )}

                                                    {/* Action buttons (Reply, React, Edit, Delete) */}
                                                    {!msg.is_deleted && !isEditing && (
                                                        <div className="absolute right-0 top-0 -translate-y-full hidden group-hover/msg:flex items-center gap-1 bg-slate-900 border border-white/10 px-1 py-0.5 rounded-lg shadow-lg">
                                                            <button
                                                                onClick={() => handleReply(msg)}
                                                                className="p-1 hover:text-correct text-gray-400 cursor-pointer"
                                                                title="Reply"
                                                            >
                                                                <Reply className="w-2.5 h-2.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setReactingMessageId(reactingMessageId === msg.id ? null : msg.id)}
                                                                className="p-1 hover:text-yellow-400 text-gray-400 cursor-pointer"
                                                                title="React"
                                                            >
                                                                <Smile className="w-2.5 h-2.5" />
                                                            </button>
                                                            {isMe && !msg.voice_url && !msg.image_url && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingMessageId(msg.id);
                                                                        setEditText(getDecryptedContent(msg));
                                                                    }}
                                                                    className="p-1 hover:text-indigo-400 text-gray-400 cursor-pointer"
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 className="w-2.5 h-2.5" />
                                                                </button>
                                                            )}
                                                            {isMe && (
                                                                <button
                                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                                    className="p-1 hover:text-rose-400 text-gray-400 cursor-pointer"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-2.5 h-2.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Reaction badges */}
                                                    {msg.reactions && Object.keys(msg.reactions).length > 0 && !msg.is_deleted && (
                                                        <ReactionBadge
                                                            reactions={msg.reactions}
                                                            isMe={isMe}
                                                            onShowDetails={() => setShowReactionDetailsId(showReactionDetailsId === msg.id ? null : msg.id)}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
        </div>
    )
}

export default FloatingContentList
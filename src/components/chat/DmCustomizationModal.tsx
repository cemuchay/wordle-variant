import { useState } from "react";
import { Sparkles, Trash2, X, UserPen, Check, RotateCcw, Plus } from "lucide-react";
import {
   MAX_TRIGGER_WORD_LENGTH,
   MAX_WORD_EFFECTS_PER_DM,
   normalizeEffectEmoji,
   type DmWordEffect,
} from "../../utils/wordEffects";
import { MAX_DM_NICKNAME_LENGTH } from "../../utils/dmNicknames";
import { renderEmojiNode } from "../../utils/twemoji";
import { ProtectedAvatar } from "./ProtectedAvatar";

const QUICK_EMOJIS = [
   "❤️", "🔥", "😂", "🎉", "🏆", "🥳", "😍", "💯",
   "👏", "✨", "🚀", "💀", "😭", "👑", "🎂", "🌈",
   "⚡", "🫶", "🍀", "🎵", "🦋", "💎", "😈", "🤩",
];

interface ParticipantInfo {
   id: string;
   username: string;
   avatar_url?: string;
}

interface DmCustomizationModalProps {
   isOpen: boolean;
   onClose: () => void;
   // Word effects
   effects: DmWordEffect[];
   isLoadingEffects: boolean;
   onAddEffect: (triggerWord: string, emoji: string) => Promise<DmWordEffect>;
   onRemoveEffect: (effectId: string) => Promise<void>;
   onPreviewEffect: (emoji: string) => void;
   // Nicknames
   currentUser: ParticipantInfo;
   partner: ParticipantInfo;
   currentUserNickname: string;
   partnerNickname: string;
   onSaveNickname: (targetUserId: string, nickname: string) => Promise<void>;
   onClearNickname: (targetUserId: string) => Promise<void>;
}

export function DmCustomizationModal({
   isOpen,
   onClose,
   effects,
   isLoadingEffects,
   onAddEffect,
   onRemoveEffect,
   onPreviewEffect,
   currentUser,
   partner,
   currentUserNickname,
   partnerNickname,
   onSaveNickname,
   onClearNickname,
}: DmCustomizationModalProps) {
   const [activeTab, setActiveTab] = useState<"effects" | "nicknames">("effects");

   // Word effect form state
   const [wordInput, setWordInput] = useState("");
   const [emojiInput, setEmojiInput] = useState("❤️");
   const [isSavingEffect, setIsSavingEffect] = useState(false);
   const [deletingId, setDeletingId] = useState<string | null>(null);
   const [effectError, setEffectError] = useState<string | null>(null);

   // Nickname form state
   const [partnerDraft, setPartnerDraft] = useState(partnerNickname);
   const [selfDraft, setSelfDraft] = useState(currentUserNickname);
   const [savingNickFor, setSavingNickFor] = useState<string | null>(null);
   const [nickFeedback, setNickFeedback] = useState<string | null>(null);

   if (!isOpen) return null;

   const cleanEmoji = normalizeEffectEmoji(emojiInput);
   const canAddEffect = Boolean(wordInput.trim() && cleanEmoji && !isSavingEffect);

   const handleAddEffect = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canAddEffect) return;
      setEffectError(null);
      setIsSavingEffect(true);
      try {
         const saved = await onAddEffect(wordInput, cleanEmoji);
         setWordInput("");
         onPreviewEffect(saved.emoji);
      } catch (err) {
         setEffectError(err instanceof Error ? err.message : "Could not save word effect.");
      } finally {
         setIsSavingEffect(false);
      }
   };

   const handleDeleteEffect = async (id: string) => {
      setDeletingId(id);
      setEffectError(null);
      try {
         await onRemoveEffect(id);
      } catch (err) {
         setEffectError(err instanceof Error ? err.message : "Could not delete word effect.");
      } finally {
         setDeletingId(null);
      }
   };

   const handleSaveNick = async (targetUserId: string, draft: string) => {
      setSavingNickFor(targetUserId);
      setNickFeedback(null);
      try {
         await onSaveNickname(targetUserId, draft);
         setNickFeedback("Nickname updated");
      } catch (err) {
         setNickFeedback(err instanceof Error ? err.message : "Failed to save nickname.");
      } finally {
         setSavingNickFor(null);
      }
   };

   const handleClearNick = async (targetUserId: string) => {
      setSavingNickFor(targetUserId);
      setNickFeedback(null);
      try {
         await onClearNickname(targetUserId);
         if (targetUserId === partner.id) setPartnerDraft("");
         if (targetUserId === currentUser.id) setSelfDraft("");
         setNickFeedback("Nickname reset");
      } catch (err) {
         setNickFeedback(err instanceof Error ? err.message : "Failed to reset nickname.");
      } finally {
         setSavingNickFor(null);
      }
   };

   return (
      <div
         className="absolute inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex flex-col animate-in fade-in duration-150"
         onClick={(e) => e.stopPropagation()}
      >
         {/* Header */}
         <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0">
            <div className="flex items-center gap-2">
               <Sparkles className="w-4 h-4 text-amber-400" />
               <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  DM Customization
               </h3>
            </div>
            <button
               type="button"
               onClick={onClose}
               className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
               title="Close"
            >
               <X className="w-4 h-4" />
            </button>
         </div>

         {/* Tabs */}
         <div className="px-4 pt-3 pb-2 flex gap-2 shrink-0">
            <button
               type="button"
               onClick={() => setActiveTab("effects")}
               className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                  activeTab === "effects"
                     ? "bg-amber-500/15 text-amber-300 border-amber-400/40"
                     : "bg-white/5 text-gray-400 border-white/5 hover:text-white hover:bg-white/10"
               }`}
            >
               <Sparkles className="w-3.5 h-3.5" />
               Word Effects
               {effects.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10">
                     {effects.length}
                  </span>
               )}
            </button>
            <button
               type="button"
               onClick={() => {
                  setPartnerDraft(partnerNickname);
                  setSelfDraft(currentUserNickname);
                  setNickFeedback(null);
                  setActiveTab("nicknames");
               }}
               className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                  activeTab === "nicknames"
                     ? "bg-indigo-500/20 text-indigo-300 border-indigo-400/40"
                     : "bg-white/5 text-gray-400 border-white/5 hover:text-white hover:bg-white/10"
               }`}
            >
               <UserPen className="w-3.5 h-3.5" />
               Nicknames
            </button>
         </div>

         {/* Body */}
         <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {activeTab === "effects" ? (
               <>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                     Attach any word or phrase to an emoji. Whenever either of you sends it in this DM, emojis float up across the chat!
                  </p>

                  {/* Add Form */}
                  <form onSubmit={handleAddEffect} className="space-y-2.5 bg-white/5 border border-white/10 rounded-2xl p-3">
                     <div className="flex items-center gap-2">
                        <input
                           type="text"
                           value={emojiInput}
                           onChange={(e) => setEmojiInput(e.target.value)}
                           aria-label="Effect emoji"
                           placeholder="❤️"
                           className="w-12 h-10 text-center text-lg bg-slate-900 border border-white/15 rounded-xl text-white focus:outline-none focus:border-amber-400/60 shrink-0"
                        />
                        <input
                           type="text"
                           value={wordInput}
                           onChange={(e) => setWordInput(e.target.value)}
                           maxLength={MAX_TRIGGER_WORD_LENGTH}
                           placeholder="Word or phrase (e.g. gg, love)"
                           className="flex-1 min-w-0 h-10 px-3 text-xs bg-slate-900 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/60"
                        />
                        <button
                           type="submit"
                           disabled={!canAddEffect}
                           className="h-10 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        >
                           <Plus className="w-3.5 h-3.5" />
                           Add
                        </button>
                     </div>

                     {/* Quick Emoji Picker Grid */}
                     <div className="grid grid-cols-8 gap-1 pt-1">
                        {QUICK_EMOJIS.map((em) => (
                           <button
                              key={em}
                              type="button"
                              onClick={() => setEmojiInput(em)}
                              className={`h-8 rounded-lg flex items-center justify-center text-base transition-all cursor-pointer ${
                                 cleanEmoji === em
                                    ? "bg-amber-500/25 ring-1 ring-amber-400/60 scale-105"
                                    : "hover:bg-white/10"
                              }`}
                              title={`Select ${em}`}
                           >
                              {renderEmojiNode(em, `pick-${em}`)}
                           </button>
                        ))}
                     </div>

                     {effectError && (
                        <p className="text-[11px] text-rose-400 font-medium">{effectError}</p>
                     )}
                  </form>

                  {/* Active Word Effects List */}
                  <div className="space-y-1.5">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                           Active Effects ({effects.length}/{MAX_WORD_EFFECTS_PER_DM})
                        </span>
                     </div>

                     {isLoadingEffects && effects.length === 0 ? (
                        <p className="text-xs text-gray-500 py-4 text-center">Loading word effects...</p>
                     ) : effects.length === 0 ? (
                        <div className="py-6 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                           <p className="text-xs text-gray-400">No word effects yet</p>
                           <p className="text-[10px] text-gray-500 mt-0.5">
                              Add one above to make emojis rain upward!
                           </p>
                        </div>
                     ) : (
                        <div className="space-y-1.5">
                           {effects.map((effect) => (
                              <div
                                 key={effect.id}
                                 className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10"
                              >
                                 <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-lg shrink-0">
                                       {renderEmojiNode(effect.emoji, `row-${effect.id}`)}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-100 truncate">
                                       {effect.trigger_word}
                                    </span>
                                 </div>
                                 <div className="flex items-center gap-1 shrink-0">
                                    <button
                                       type="button"
                                       onClick={() => onPreviewEffect(effect.emoji)}
                                       className="p-1.5 rounded-lg text-amber-300 hover:bg-amber-500/15 transition-colors cursor-pointer"
                                       title="Preview effect"
                                    >
                                       <Sparkles className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                       type="button"
                                       disabled={deletingId === effect.id}
                                       onClick={() => handleDeleteEffect(effect.id)}
                                       className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/15 disabled:opacity-40 transition-colors cursor-pointer"
                                       title="Remove effect"
                                    >
                                       <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </>
            ) : (
               <>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                     Set custom nicknames just for this DM conversation. Both of you can set or clear nicknames for each other.
                  </p>

                  {/* Partner Nickname Card */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2.5">
                     <div className="flex items-center gap-2.5">
                        <ProtectedAvatar
                           userId={partner.id}
                           src={partner.avatar_url}
                           username={partner.username}
                           className="w-8 h-8 rounded-full border border-white/10 shrink-0"
                        />
                        <div className="min-w-0">
                           <p className="text-xs font-bold text-white truncate">
                              {partnerNickname || partner.username}
                           </p>
                           <p className="text-[10px] text-gray-400 truncate">
                              @{partner.username}
                           </p>
                        </div>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <input
                           type="text"
                           value={partnerDraft}
                           onChange={(e) => setPartnerDraft(e.target.value)}
                           maxLength={MAX_DM_NICKNAME_LENGTH}
                           placeholder={`Set nickname for ${partner.username}`}
                           className="flex-1 min-w-0 h-9 px-3 text-xs bg-slate-900 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400/60"
                        />
                        <button
                           type="button"
                           disabled={savingNickFor === partner.id || partnerDraft.trim() === partnerNickname}
                           onClick={() => handleSaveNick(partner.id, partnerDraft)}
                           className="h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                           title="Save nickname"
                        >
                           <Check className="w-3.5 h-3.5" />
                           Save
                        </button>
                        {partnerNickname && (
                           <button
                              type="button"
                              disabled={savingNickFor === partner.id}
                              onClick={() => handleClearNick(partner.id)}
                              className="h-9 px-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-gray-300 hover:text-rose-300 transition-colors cursor-pointer shrink-0"
                              title="Reset to username"
                           >
                              <RotateCcw className="w-3.5 h-3.5" />
                           </button>
                        )}
                     </div>
                  </div>

                  {/* Self Nickname Card */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2.5">
                     <div className="flex items-center gap-2.5">
                        <ProtectedAvatar
                           userId={currentUser.id}
                           src={currentUser.avatar_url}
                           username={currentUser.username}
                           className="w-8 h-8 rounded-full border border-white/10 shrink-0"
                        />
                        <div className="min-w-0">
                           <p className="text-xs font-bold text-white truncate">
                              {currentUserNickname || currentUser.username}{" "}
                              <span className="text-[10px] font-normal text-indigo-300">(You)</span>
                           </p>
                           <p className="text-[10px] text-gray-400 truncate">
                              @{currentUser.username}
                           </p>
                        </div>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <input
                           type="text"
                           value={selfDraft}
                           onChange={(e) => setSelfDraft(e.target.value)}
                           maxLength={MAX_DM_NICKNAME_LENGTH}
                           placeholder="Set your nickname in this DM"
                           className="flex-1 min-w-0 h-9 px-3 text-xs bg-slate-900 border border-white/15 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400/60"
                        />
                        <button
                           type="button"
                           disabled={savingNickFor === currentUser.id || selfDraft.trim() === currentUserNickname}
                           onClick={() => handleSaveNick(currentUser.id, selfDraft)}
                           className="h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                           title="Save your nickname"
                        >
                           <Check className="w-3.5 h-3.5" />
                           Save
                        </button>
                        {currentUserNickname && (
                           <button
                              type="button"
                              disabled={savingNickFor === currentUser.id}
                              onClick={() => handleClearNick(currentUser.id)}
                              className="h-9 px-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-gray-300 hover:text-rose-300 transition-colors cursor-pointer shrink-0"
                              title="Reset to username"
                           >
                              <RotateCcw className="w-3.5 h-3.5" />
                           </button>
                        )}
                     </div>
                  </div>

                  {nickFeedback && (
                     <p className="text-[11px] text-emerald-400 font-medium text-center">
                        {nickFeedback}
                     </p>
                  )}
               </>
            )}
         </div>
      </div>
   );
}

export default DmCustomizationModal;

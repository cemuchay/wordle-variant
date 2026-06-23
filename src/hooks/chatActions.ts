import { supabase } from "../lib/supabaseClient";
import { useAppStore } from "../store/useAppStore";
import { getDMRoomKey, encryptDM } from "./useChat";

export async function editMessage(
  messageId: string,
  newContent: string,
  userId: string,
  group?: { type?: string; dm_partner?: { id: string } },
) {
  if (!userId || !newContent.trim()) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg = (useAppStore.getState().globalMessages as any[]).find((m: any) => m.id === messageId);
  if (msg) {
    const elapsed = Date.now() - new Date(msg.created_at).getTime();
    if (elapsed > 15 * 60 * 1000) {
      useAppStore.getState().triggerToast("Editing window expired (15 min)", 2000);
      return;
    }
  }

  let finalContent = newContent;
  if (group?.type === "dm" && group.dm_partner) {
    const key = getDMRoomKey(userId, group.dm_partner.id);
    finalContent = encryptDM(newContent, key);
  }

  useAppStore.getState().updateGlobalMessage({
    id: messageId,
    content: newContent,
    is_edited: true,
  });

  const { error } = await supabase
    .from("messages")
    .update({ content: finalContent, is_edited: true })
    .eq("id", messageId);

  if (error) {
    console.error("Failed to edit:", error);
  }
}

export async function deleteMessage(messageId: string, userId: string) {
  if (!userId) return;

  useAppStore.getState().updateGlobalMessage({
    id: messageId,
    content: "🚫 This message was deleted",
    is_deleted: true,
    voice_url: null,
    image_url: null,
    reactions: {},
  });

  const { error } = await supabase
    .from("messages")
    .update({
      content: "🚫 This message was deleted",
      is_deleted: true,
      voice_url: null,
      image_url: null,
      reactions: {},
    })
    .eq("id", messageId);

  if (error) {
    console.error("Failed to delete message:", error);
  }
}

export async function reactToMessage(
  messageId: string,
  emoji: string | null,
  userId: string,
) {
  if (!userId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg = (useAppStore.getState().globalMessages as any[]).find((m: any) => m.id === messageId);
  if (!msg) return;

  const currentReactions = { ...(msg.reactions || {}) };
  if (emoji) {
    currentReactions[userId] = emoji;
  } else {
    delete currentReactions[userId];
  }

  useAppStore
    .getState()
    .updateGlobalMessage({ id: messageId, reactions: currentReactions });

  const { error } = await supabase.rpc("toggle_message_reaction", {
    p_message_id: messageId,
    p_user_id: userId,
    p_emoji: emoji,
  });

  if (error) {
    console.error("Failed to react resiliently:", error);
  }
}

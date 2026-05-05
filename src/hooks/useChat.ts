import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export const useChat = () => {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const [messages, setMessages] = useState<any[]>([]);
   const [loading, setLoading] = useState(false);

   useEffect(() => {
      // 1. Fetch initial messages from the last 24h
      const fetchInitial = async () => {
         setLoading(true);
         const { data } = await supabase
            .from("messages")
            .select("*, profiles(username, avatar_url)")
            .order("created_at", { ascending: true });
         if (data) setMessages(data);
         setLoading(false);
      };

      fetchInitial();

      // 2. Subscribe to new messages in real-time
      const channel = supabase
         .channel("public:messages")
         .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            async (payload) => {
               // Fetch profile for the new message to keep UI consistent
               const { data } = await supabase
                  .from("profiles")
                  .select("username, avatar_url")
                  .eq("id", payload.new.user_id)
                  .single();

               const newMessage = { ...payload.new, profiles: data };
               setMessages((prev) => [...prev, newMessage]);
            }
         )
         .subscribe();

      return () => {
         supabase.removeChannel(channel);
      };
   }, []);

   const sendMessage = async (content: string, userId: string) => {
      if (!content.trim()) return;

      const result = content;

      await supabase.from("messages").insert([
         {
            content: result,
            user_id: userId,
         },
      ]);
   };

   return { messages, sendMessage, loading };
};

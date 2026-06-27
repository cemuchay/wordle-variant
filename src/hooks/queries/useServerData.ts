import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { getServerDate } from "../../lib/time";
import { safeLocalStorage } from "../../utils/storage";

/**
 * Hook to fetch the authoritative server date.
 */
export const useAuthoritativeDate = () => {
   return useQuery({
      queryKey: ["server-date"],
      queryFn: async () => {
         const date = await getServerDate();
         safeLocalStorage.setItem("cached-server-date", JSON.stringify(date));
         return date;
      },
      placeholderData: () => {
         const cached = safeLocalStorage.getItem("cached-server-date");
         if (cached) {
            return JSON.parse(cached as string);
         }
         return undefined;
      },
      staleTime: 1000 * 60 * 60, // 1 hour
   });
};

/**
 * Hook to fetch and sync the user's profile.
 */
export const useProfile = (userId: string | undefined) => {
   return useQuery({
      queryKey: ["profile", userId],
      queryFn: async () => {
         if (!userId) return null;
         const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();
         if (error) throw error;

         safeLocalStorage.setItem(
            `cached-profile-${userId}`,
            JSON.stringify(data),
         );
         return data;
      },
      placeholderData: (previousData) => {
         if (previousData) return previousData;
         if (!userId) return null;
         try {
            const cached = safeLocalStorage.getItem(`cached-profile-${userId}`);
            return cached ? JSON.parse(cached) : undefined;
         } catch {
            return undefined;
         }
      },
      enabled: !!userId,
   });
};

/**
 * Hook to fetch challenge unread counts.
 */
export const useChallengeStatus = (userId: string | undefined) => {
   return useQuery({
      queryKey: ["challenge-unread", userId],
      queryFn: async () => {
         if (!userId) return { unreadCount: 0, participations: [] };

         const { data, error } = await supabase
            .from("challenge_participants")
            .select("challenge_id, status, challenge:challenges(expires_at)")
            .eq("user_id", userId);

         if (error) throw error;

         const unread = data.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) =>
               (c.status === "pending" || c.status === "playing") &&
               new Date(c.challenge.expires_at) > new Date(),
         ).length;

         const result = {
            unreadCount: unread,
            participations: data.map((p) => p.challenge_id),
         };

         safeLocalStorage.setItem(
            `cached-challenge-status-${userId}`,
            JSON.stringify(result),
         );
         return result;
      },
      placeholderData: (previousData) => {
         if (previousData) return previousData;
         if (!userId) return null;
         try {
            const cached = safeLocalStorage.getItem(
               `cached-challenge-status-${userId}`,
            );
            return cached ? JSON.parse(cached) : undefined;
         } catch {
            return undefined;
         }
      },
      enabled: !!userId,
   });
};

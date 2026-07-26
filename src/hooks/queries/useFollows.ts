import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

export interface FollowUser {
   id: string;
   username: string;
   full_name?: string;
   avatar_url?: string;
   last_seen_at?: string;
}

export function useUserFollowers(userId: string | undefined) {
   return useQuery({
      queryKey: ["user_followers", userId],
      queryFn: async (): Promise<FollowUser[]> => {
         if (!userId) return [];
         const { data, error } = await supabase
            .from("follows")
            .select("follower_id, created_at, profiles:follower_id(id, username, full_name, avatar_url, last_seen_at)")
            .eq("following_id", userId)
            .order("created_at", { ascending: false });

         if (error) throw error;
         return (data || [])
            .map((item: any) => item.profiles)
            .filter((p: any): p is FollowUser => !!p && !!p.id);
      },
      enabled: !!userId,
      staleTime: 1000 * 60 * 5, // 5 minutes cache-first
   });
}

export function useUserFollowing(userId: string | undefined) {
   return useQuery({
      queryKey: ["user_following", userId],
      queryFn: async (): Promise<FollowUser[]> => {
         if (!userId) return [];
         const { data, error } = await supabase
            .from("follows")
            .select("following_id, created_at, profiles:following_id(id, username, full_name, avatar_url, last_seen_at)")
            .eq("follower_id", userId)
            .order("created_at", { ascending: false });

         if (error) throw error;
         return (data || [])
            .map((item: any) => item.profiles)
            .filter((p: any): p is FollowUser => !!p && !!p.id);
      },
      enabled: !!userId,
      staleTime: 1000 * 60 * 5, // 5 minutes cache-first
   });
}

export function useIsFollowing(currentUserId: string | undefined, targetUserId: string | undefined) {
   return useQuery({
      queryKey: ["is_following", currentUserId, targetUserId],
      queryFn: async (): Promise<boolean> => {
         if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;
         const { data, error } = await supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", currentUserId)
            .eq("following_id", targetUserId)
            .maybeSingle();

         if (error) throw error;
         return !!data;
      },
      enabled: !!currentUserId && !!targetUserId && currentUserId !== targetUserId,
      staleTime: 1000 * 60 * 5,
   });
}

export function useToggleFollowMutation() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         currentUserId,
         targetUserId,
         isFollowing,
      }: {
         currentUserId: string;
         targetUserId: string;
         isFollowing: boolean;
      }) => {
         if (isFollowing) {
            const { error } = await supabase
               .from("follows")
               .delete()
               .eq("follower_id", currentUserId)
               .eq("following_id", targetUserId);
            if (error) throw error;
            return false;
         } else {
            const { error } = await supabase
               .from("follows")
               .insert({
                  follower_id: currentUserId,
                  following_id: targetUserId,
               });
            if (error) throw error;
            return true;
         }
      },
      onSuccess: (_, variables) => {
         const { currentUserId, targetUserId } = variables;
         queryClient.invalidateQueries({ queryKey: ["user_followers", targetUserId] });
         queryClient.invalidateQueries({ queryKey: ["user_following", currentUserId] });
         queryClient.invalidateQueries({ queryKey: ["is_following", currentUserId, targetUserId] });
      },
   });
}

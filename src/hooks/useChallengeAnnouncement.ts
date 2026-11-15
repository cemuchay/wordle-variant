/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, useCallback } from "react";
import {
   hasSeenChallengeAnnouncementToday,
   hasVisitedChallengesRecently,
   markChallengeAnnouncementSeenToday,
   recordChallengesTabVisit,
} from "../utils/challengePromptStorage";
import { supabase } from "@/lib/supabaseClient";

const PROMPT_DELAY_MS = 7000; // 7 seconds (within the 5-10s post-load window)

interface UseChallengeAnnouncementOptions {
   userId?: string;
   activeNavigationItem?: string;
   isChallengeModalOpen?: boolean;
   isOtherModalOpen?: boolean;
}

/**
 * Manages the daily challenge (Marathon) announcement modal.
 *
 * Fetches the active marathon challenge and shows the modal once per day,
 * 7 seconds after app load, if the user has not visited the Challenges tab
 * in the last 24 hours.
 */
export function useChallengeAnnouncement({
   userId,
   activeNavigationItem,
   isChallengeModalOpen = false,
   isOtherModalOpen = false,
}: UseChallengeAnnouncementOptions) {
   const [isOpen, setIsOpen] = useState(false);
   const [marathonChallenge, setMarathonChallenge] = useState<any | null>(null);

   // Fetch the active marathon challenge when user is logged in
   useEffect(() => {
      if (!userId) {
         setMarathonChallenge(null);
         return;
      }

      let cancelled = false;
      const fetchActiveMarathon = async () => {
         try {
            const nowIso = new Date().toISOString();
            const { data, error } = await supabase
               .from("challenges")
               .select(
                  "*, participants:challenge_participants(user_id, score, profiles(id, username))",
               )
               .eq("is_bot_marathon", true)
               .gt("expires_at", nowIso)
               .order("created_at", { ascending: false })
               .limit(1)
               .maybeSingle();

            if (!cancelled && !error && data) {
               // Wrap in { challenge: data, expires_at: data.expires_at } to match MarathonBanner's expected shape
               setMarathonChallenge({
                  ...data,
                  challenge: data,
               });
            }
         } catch {
            // Ignore fetch errors silently
         }
      };

      fetchActiveMarathon();
      return () => {
         cancelled = true;
      };
   }, [userId]);

   // Determine whether the current user has already joined this marathon
   const hasJoined = useMemo(() => {
      if (!userId || !marathonChallenge) return false;
      const participants = marathonChallenge?.challenge?.participants || [];
      return participants.some(
         (p: any) => p?.user_id === userId || p?.profiles?.id === userId,
      );
   }, [userId, marathonChallenge]);

   // Record visits whenever the user opens the Challenges tab or ChallengeModal
   useEffect(() => {
      if (activeNavigationItem === "challenges" || isChallengeModalOpen) {
         recordChallengesTabVisit();
         setIsOpen(false);
      }
   }, [activeNavigationItem, isChallengeModalOpen]);

   // Schedule the delayed announcement prompt on first daily open
   useEffect(() => {
      if (!userId || !marathonChallenge) return;
      if (activeNavigationItem === "challenges" || isChallengeModalOpen) return;
      if (isOtherModalOpen) return;
      if (hasVisitedChallengesRecently() || hasSeenChallengeAnnouncementToday())
         return;

      const timer = setTimeout(() => {
         // Re-check eligibility right before showing
         if (
            hasVisitedChallengesRecently() ||
            hasSeenChallengeAnnouncementToday()
         ) {
            return;
         }
         markChallengeAnnouncementSeenToday();
         setIsOpen(true);
      }, PROMPT_DELAY_MS);

      return () => clearTimeout(timer);
   }, [
      userId,
      marathonChallenge,
      activeNavigationItem,
      isChallengeModalOpen,
      isOtherModalOpen,
   ]);

   const dismiss = useCallback(() => {
      markChallengeAnnouncementSeenToday();
      setIsOpen(false);
   }, []);

   return {
      isOpen,
      marathonChallenge,
      hasJoined,
      dismiss,
   };
}

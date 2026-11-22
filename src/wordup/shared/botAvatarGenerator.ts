import type { RegionCode } from "./locationEstimator";

export type BotGender = "male" | "female";

/**
 * Curated, high-availability realistic portrait photographs (Unsplash CDN cropped 256x256 face portraits)
 * grouped by demographic region and gender so synthetic profiles have authentic, real-world profile pictures.
 */
const REALISTIC_PORTRAITS: Record<
   "african" | "global_diverse" | "south_asian",
   Record<BotGender, string[]>
> = {
   african: {
      male: [
         "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1539701938214-0d9736e1c16b?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1504199367641-aba8151af406?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1618077360395-f3068be8e001?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=256&q=80",
      ],
      female: [
         "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1611432579699-484f7990b127?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1598550874175-4d0ef436c909?auto=format&fit=crop&w=256&q=80",
      ],
   },
   global_diverse: {
      male: [
         "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80",
      ],
      female: [
         "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80",
      ],
   },
   south_asian: {
      male: [
         "https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=256&q=80",
      ],
      female: [
         "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1598550874175-4d0ef436c909?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1611432579699-484f7990b127?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80",
         "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
      ],
   },
};

/**
 * Non-selfie realistic social profile images (pets, cars, nature, street art, minimalist photography)
 * used by ~20% of profiles because real gaming/social users mix portraits with aesthetic photos.
 */
const AESTHETIC_SOCIAL_AVATARS: string[] = [
   "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=256&q=80",
   "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=256&q=80",
   "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=256&q=80",
   "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=256&q=80",
   "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=256&q=80",
   "https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=256&q=80",
   "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=256&q=80",
   "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=256&q=80",
];

function hashSeed(seed: string): number {
   let h = 2166136261;
   for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
   }
   return Math.abs(h);
}

/**
 * Generates a realistic avatar URL for a synthetic user profile, aligned with their region and gender.
 */
export function generateRealisticBotAvatar(
   seed: string,
   region: RegionCode,
   gender: BotGender,
): string {
   const h = hashSeed(seed);
   const roll = (h % 100) / 100;

   // 72% realistic human portraits (region & gender matched)
   if (roll < 0.72) {
      const poolKey =
         region === "NG" || region === "GH" || region === "KE" || region === "ZA"
            ? "african"
            : region === "IN"
               ? "south_asian"
               : "global_diverse";
      const list = REALISTIC_PORTRAITS[poolKey][gender];
      return list[h % list.length];
   }

   // 16% realistic photography / lifestyle / pet avatars
   if (roll < 0.88) {
      return AESTHETIC_SOCIAL_AVATARS[h % AESTHETIC_SOCIAL_AVATARS.length];
   }

   // 12% illustrated human avatars (never robot/bottts!)
   const humanStyles = ["avataaars", "lorelei", "notionists", "micah"];
   const style = humanStyles[h % humanStyles.length];
   return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}


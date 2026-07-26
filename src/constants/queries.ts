/** Query stale-time and garbage-collection values for TanStack Query. */
export const QUERY = {
   STALE_10S: 10_000,
   STALE_15S: 15_000,
   STALE_30S: 30_000,
   STALE_1M: 60_000,
   STALE_2M: 120_000,
   STALE_5M: 300_000,
   STALE_15M: 900_000,
   STALE_1H: 3_600_000,
   STALE_24H: 86_400_000,
   GC_1M: 60_000,
   GC_5M: 300_000,
   GC_10M: 600_000,
} as const;

/** Default retry count for TanStack Query. */
export const QUERY_RETRY = 3;

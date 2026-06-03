const formatLastSeen = (dateStr?: string): string => {
   if (!dateStr) return "Never";

   const date = new Date(dateStr);
   const now = new Date();
   const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);

   if (diffMins < 1) return "Just now";
   if (diffMins < 60) return `${diffMins}m ago`;

   // Setup local time formatting options
   const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
   };
   const localTime = date.toLocaleTimeString(undefined, timeOptions);

   const diffHours = Math.floor(diffMins / 60);
   if (diffHours < 24) {
      return localTime;
   }

   // Check if the date was calendar day "yesterday"
   const yesterday = new Date(now);
   yesterday.setDate(now.getDate() - 1);

   const isYesterday = date.toDateString() === yesterday.toDateString();
   if (isYesterday) {
      return `Yesterday at ${localTime}`;
   }

   // More than 24 hours and not yesterday -> Full date and time
   const localDate = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
   });
   return `${localDate}, ${localTime}`;
};

export default formatLastSeen;

import { CalendarPanel } from "@/components/root/social/stage-panels";

/**
 * A pipeline stage the Hub does not implement — the calendar's output is a
 * dated table nothing here persists, so the page says where the stage actually
 * runs and hands over the words to say (see stage-note.tsx).
 */
export default function SocialCalendarPage() {
  return <CalendarPanel />;
}

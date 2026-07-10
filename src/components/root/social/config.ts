// Channel registry for the Social Hub — single source of truth shared by the
// dashboard toggles and the server-action Zod schema. `wired` flips to true
// only when the Hermes gateway has a working adapter + credentials for the
// channel (Slack today — see /docs/hermes; per-channel reality lives in
// docs/SOCIAL-AUTOMATION.md).

export interface SocialChannel {
  id: string;
  label: string;
  labelAr: string;
  wired: boolean;
}

export const CHANNELS = [
  { id: "slack", label: "Slack", labelAr: "سلاك", wired: true },
  { id: "telegram", label: "Telegram", labelAr: "تيليجرام", wired: false },
  { id: "whatsapp", label: "WhatsApp", labelAr: "واتساب", wired: false },
  { id: "x", label: "X / Twitter", labelAr: "إكس", wired: false },
  { id: "linkedin", label: "LinkedIn", labelAr: "لينكدإن", wired: false },
  { id: "facebook", label: "Facebook", labelAr: "فيسبوك", wired: false },
  { id: "instagram", label: "Instagram", labelAr: "إنستغرام", wired: false },
  { id: "tiktok", label: "TikTok", labelAr: "تيك توك", wired: false },
  { id: "snapchat", label: "Snapchat", labelAr: "سناب شات", wired: false },
] as const satisfies readonly SocialChannel[];

export type ChannelId = (typeof CHANNELS)[number]["id"];

export const CHANNEL_IDS = CHANNELS.map((c) => c.id) as [
  ChannelId,
  ...ChannelId[],
];

export const WIRED_CHANNEL_IDS: ChannelId[] = CHANNELS.filter(
  (c) => c.wired,
).map((c) => c.id);

// Channel registry for the Social Hub — single source of truth shared by the
// dashboard toggles and the server-action Zod schema. `wired` flips to true
// only when the channel's egress transport is actually implemented:
//   transport "telegram" — direct Bot API from the site (works on Vercel)
//   transport "facebook" — direct Graph API from the site (works on Vercel)
//   transport "hermes"   — relayed through the Hermes gateway adapter
// Per-channel reality lives in docs/SOCIAL-AUTOMATION.md; see /docs/hermes.

export type ChannelTransport = "telegram" | "facebook" | "hermes";

export interface SocialChannel {
  id: string;
  label: string;
  labelAr: string;
  wired: boolean;
  transport: ChannelTransport;
}

export const CHANNELS = [
  {
    id: "telegram",
    label: "Telegram",
    labelAr: "تيليجرام",
    wired: true,
    transport: "telegram",
  },
  {
    id: "slack",
    label: "Slack",
    labelAr: "سلاك",
    wired: true,
    transport: "hermes",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    labelAr: "واتساب",
    wired: false,
    transport: "hermes",
  },
  {
    id: "x",
    label: "X / Twitter",
    labelAr: "إكس",
    wired: false,
    transport: "hermes",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    labelAr: "لينكدإن",
    wired: false,
    transport: "hermes",
  },
  {
    id: "facebook",
    label: "Facebook",
    labelAr: "فيسبوك",
    // Transport is implemented (lib/facebook.ts + direct Graph API). Flip `wired`
    // to true once FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN are set in Vercel
    // env — see twenty-deploy/SOCIAL-SETUP.md.
    wired: true,
    transport: "facebook",
  },
  {
    id: "instagram",
    label: "Instagram",
    labelAr: "إنستغرام",
    wired: false,
    transport: "hermes",
  },
  {
    id: "tiktok",
    label: "TikTok",
    labelAr: "تيك توك",
    wired: false,
    transport: "hermes",
  },
  {
    id: "snapchat",
    label: "Snapchat",
    labelAr: "سناب شات",
    wired: false,
    transport: "hermes",
  },
] as const satisfies readonly SocialChannel[];

export type ChannelId = (typeof CHANNELS)[number]["id"];

export const CHANNEL_IDS = CHANNELS.map((c) => c.id) as [
  ChannelId,
  ...ChannelId[],
];

export const WIRED_CHANNEL_IDS: ChannelId[] = CHANNELS.filter(
  (c) => c.wired,
).map((c) => c.id);

// Mirrors the script check in lib/report/score.ts — any Arabic-script char
// makes the piece Arabic; brand copy is never half-and-half in practice.
// Detection over plumbing the UI language: an Arabic post is routinely staged
// from the English UI, so the copy itself is the only honest signal.
export function detectSocialLocale(text: string): "ar" | "en" {
  return /\p{Script=Arabic}/u.test(text) ? "ar" : "en";
}

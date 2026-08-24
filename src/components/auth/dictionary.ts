// Client-safe auth strings.
//
// The mature auth block threads a server-loaded `dictionary` prop into every
// form. Kun's dictionary (src/components/local) is `server-only`, and the login
// form also renders inside the header's client `UserButton` where no server
// dictionary is reachable — so the auth copy lives here as a small, static,
// client-importable slice instead. One home for every auth string, replacing
// the `isAr ? … : …` ternaries that were scattered across login.tsx and
// user-button.tsx.

export type AuthLang = "ar" | "en";

export interface AuthText {
  title: string;
  description: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  signIn: string;
  signingIn: string;
  signOut: string;
  profile: string;
  back: string;
  // Validation + result messages, keyed by the codes the login action returns.
  emailRequired: string;
  emailInvalid: string;
  passwordRequired: string;
  invalidCredentials: string;
  somethingWrong: string;
}

const en: AuthText = {
  title: "Sign in",
  description: "Contributors only — your databayt email and password.",
  email: "Email",
  emailPlaceholder: "Enter your email",
  password: "Password",
  passwordPlaceholder: "Enter your password",
  signIn: "Sign in",
  signingIn: "Signing in…",
  signOut: "Sign out",
  profile: "Profile",
  back: "Back to home",
  emailRequired: "Email is required",
  emailInvalid: "Enter a valid email",
  passwordRequired: "Password is required",
  invalidCredentials: "Invalid credentials",
  somethingWrong: "Something went wrong",
};

const ar: AuthText = {
  title: "تسجيل الدخول",
  description: "مساحة المساهمين — بريدك في databayt وكلمة المرور.",
  email: "البريد الإلكتروني",
  emailPlaceholder: "أدخل بريدك الإلكتروني",
  password: "كلمة المرور",
  passwordPlaceholder: "أدخل كلمة المرور",
  signIn: "دخول",
  signingIn: "جاري الدخول…",
  signOut: "تسجيل الخروج",
  profile: "الملف الشخصي",
  back: "العودة للرئيسية",
  emailRequired: "البريد الإلكتروني مطلوب",
  emailInvalid: "أدخل بريدًا إلكترونيًا صحيحًا",
  passwordRequired: "كلمة المرور مطلوبة",
  invalidCredentials: "بيانات الدخول غير صحيحة",
  somethingWrong: "حدث خطأ ما",
};

const dictionaries: Record<AuthLang, AuthText> = { en, ar };

export function getAuthText(lang: string): AuthText {
  return dictionaries[lang === "ar" ? "ar" : "en"];
}

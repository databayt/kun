import NextAuth from "next-auth"
import type { DefaultSession } from "next-auth"
import { contributors } from "@/components/root/context/config"
import authConfig from "./auth.config"

const allowedEmails = contributors.map((c) => c.email)

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string
      contributorId: string
      role: string
    } & DefaultSession["user"]
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      return allowedEmails.includes(user.email)
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const contributor = contributors.find((c) => c.email === user.email)
        if (contributor) {
          token.contributorId = contributor.id
          token.role = contributor.role
        }
      }
      return token
    },
    async session({ token, session }) {
      if (session.user) {
        session.user.id = token.sub || ""
        session.user.contributorId = token.contributorId as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  session: { strategy: "jwt" },
  trustHost: true,
  ...authConfig,
})

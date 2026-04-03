import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { contributors } from "@/components/root/context/config"

export default {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string
        const password = credentials?.password as string

        if (password !== "1234") return null

        const contributor = contributors.find((c) => c.email === email)
        if (!contributor) return null

        return {
          id: contributor.id,
          name: contributor.name,
          email: contributor.email,
        }
      },
    }),
  ],
} satisfies NextAuthConfig

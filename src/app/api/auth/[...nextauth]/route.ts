import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // optional but recommended
  session: {
    strategy: "jwt", // default
  },

  callbacks: {
    async session({ session, token }) {
      // attach user id to session
      if (session.user) {
        (session.user as { id?: string }).id = token.sub!;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };

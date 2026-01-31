"use client";
import { signIn, useSession } from "next-auth/react";

export default function Login() {
  const { data: session } = useSession();
  
  if (session) {
    return <p>Welcome {session.user?.name}</p>;
  }

  return (
    <button onClick={() => signIn("google")}>
      Sign in with Google
    </button>
  );
}

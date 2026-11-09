"use client";

import { useState } from "react";
import { AuthForm } from "@/components/AuthForm";
import { LoginHub, type Audience } from "@/components/LoginHub";

export default function LoginPage() {
  const [audience, setAudience] = useState<Audience | null>(null);
  if (audience === null) return <LoginHub onPick={setAudience} />;
  return <AuthForm mode="login" audience={audience} onBack={() => setAudience(null)} />;
}

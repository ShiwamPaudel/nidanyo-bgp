"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { loginAction } from "@/lib/actions/auth-actions";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await loginAction({ email, password });
      if (res.ok) {
        toast.success("Welcome back!");
        router.replace("/dashboard");
        router.refresh();
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@laboratory.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password}>
        <div className="relative">
          <Input
            id="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            aria-label={showPw ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Button type="submit" className="w-full" size="lg" loading={pending}>
        {!pending && <LogIn className="size-4" />}
        Sign in
      </Button>
    </form>
  );
}

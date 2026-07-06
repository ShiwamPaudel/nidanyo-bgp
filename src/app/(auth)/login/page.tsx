import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="rounded-xl bg-white px-3 py-2">
            <Logo size="md" />
          </div>
        </div>
        <div className="relative z-10 space-y-4">
          <h1 className="max-w-md text-3xl font-bold leading-tight">
            The complete laboratory workflow, from liquid to logic.
          </h1>
          <p className="max-w-md text-sm text-white/80">
            Registration, billing, sample collection, result entry, pathologist approval, secure
            report delivery and end-of-day finance — all in one calm, fast workspace.
          </p>
          <ul className="grid max-w-md grid-cols-2 gap-2 pt-2 text-sm text-white/90">
            {[
              "Patient registration & billing",
              "Sample tracking",
              "Result entry & approval",
              "Secure report links & SMS",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[#FF3131]" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/60">by Infobytes Nepal</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-surface p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo size="lg" showTagline />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your laboratory workspace.
            </p>
          </div>
          <div className="mt-6">
            <LoginForm />
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Accounts are created by your administrator. There is no public sign-up.
          </p>
        </div>
      </div>
    </div>
  );
}

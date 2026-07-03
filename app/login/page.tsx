"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import BotanicalSVG from "@/components/ui/BotanicalSVG";
import BrandLockup from "@/components/ui/BrandLockup";
import { KineticTypographyLoader } from "@/components/ui/loading-animation";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success(t("welcomeBackToast"));
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <>
    {loading && <KineticTypographyLoader label={t("loggingIn")} />}
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-linen/50">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl t-glass-card animate-scale-in">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr]">

          {/* ── LEFT: Brand panel with botanical SVG ── */}
          <div className="relative px-10 py-12 bg-terra/[0.06]
            border-b border-terra/10 md:border-b-0 md:border-r
            flex flex-col justify-between overflow-hidden">

            {/* Botanical SVG — decorative background */}
            <BotanicalSVG className="absolute -right-8 -top-8 w-52 h-72 opacity-90" />

            <div className="relative z-10">
              <Link
                href="/"
                className="t-focus-ring mb-6 inline-flex items-center gap-2 text-sm text-[#C2703D] hover:text-terra-deep transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("backToHome")}
              </Link>
              <BrandLockup variant="static" className="h-10 w-auto mb-3 mt-4" />
              <p className="t-body text-smoke max-w-[220px] leading-relaxed">
                {t("brandBlurb")}
              </p>
            </div>

            <p className="relative z-10 t-label text-clay/50 mt-12 md:mt-0">
              SKFGI · MAKAUT · 2026
            </p>
          </div>

          {/* ── RIGHT: Form panel ── */}
          <div className="px-10 py-12 flex flex-col justify-center">
            <h2 className="t-heading text-xl text-bark mb-1">{t("loginTitle")}</h2>
            <p className="t-body text-smoke text-sm mb-8">{t("loginSubtitle")}</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="t-label text-smoke">{t("emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-linen/80 border-sand/60
                    focus-visible:ring-terra/20 focus-visible:border-terra
                    placeholder:text-clay/40 font-[family-name:var(--font-dm)]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="t-label text-smoke">{t("passwordLabel")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-linen/80 border-sand/60
                    focus-visible:ring-terra/20 focus-visible:border-terra
                    placeholder:text-clay/40 font-[family-name:var(--font-dm)]"
                  required
                />
              </div>

              <Button
                type="submit"
                className="btn-terra w-full mt-2"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? t("loggingIn") : t("loginButton")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-smoke">
              {t("noAccount")}{" "}
              <Link
                href="/signup"
                className="t-focus-ring font-semibold text-terra hover:underline"
              >
                {t("signUpLink")}
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
    </>
  );
}

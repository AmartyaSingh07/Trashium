"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { setLanguage } from "@/app/actions/language";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Native-script labels so each language is legible to its own speakers. Short
// code (EN/हि/বাং) is what shows on the compact trigger pill.
const LANGUAGES = [
  { code: "en", short: "EN", native: "English", english: "English" },
  { code: "hi", short: "हि", native: "हिंदी", english: "Hindi" },
  { code: "bn", short: "বাং", native: "বাংলা", english: "Bengali" },
] as const;

interface LanguageSwitcherProps {
  /** Compact icon-only trigger (used on the scrolled navbar pill). */
  iconOnly?: boolean;
  /** Full-width trigger for the mobile menu. */
  fullWidth?: boolean;
  className?: string;
}

export default function LanguageSwitcher({
  iconOnly = false,
  fullWidth = false,
  className,
}: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const active = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  const handleSelect = (code: string) => {
    if (code === locale) return;
    // Cookie (client) → instant; mirror to profile (server action) + refresh so
    // every server component re-renders with the new locale. No URL change.
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(async () => {
      await setLanguage(code);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch language"
        disabled={isPending}
        className={cn(
          "group inline-flex items-center justify-center gap-1.5 rounded-full border border-terra/25 bg-terra/[0.04] text-bark/80 transition-all duration-200 hover:border-terra/50 hover:bg-terra/[0.08] hover:text-terra focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/30 disabled:opacity-50 cursor-pointer",
          iconOnly ? "h-9 w-9" : "h-9 px-3",
          fullWidth && "w-full px-4",
          className
        )}
      >
        <Globe
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-300",
            isPending ? "animate-spin" : "group-hover:rotate-12"
          )}
        />
        {!iconOnly && (
          <span className="font-[family-name:var(--font-dm)] text-[0.7rem] font-semibold uppercase tracking-wider">
            {active.short}
          </span>
        )}
        {fullWidth && (
          <span className="ml-auto font-[family-name:var(--font-dm)] text-[0.7rem] text-bark/50">
            {active.native}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[11rem] rounded-2xl border border-terra/15 bg-linen/95 p-1.5 shadow-[0_12px_40px_-12px_rgba(42,34,24,0.35)] backdrop-blur-xl ring-0"
      >
        {LANGUAGES.map((lang) => {
          const isActive = lang.code === locale;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-terra/10 text-terra"
                  : "text-bark/75 hover:bg-terra/[0.06] hover:text-bark"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-9 shrink-0 items-center justify-center rounded-lg border text-[0.65rem] font-bold uppercase tracking-wide transition-colors",
                  isActive
                    ? "border-terra/40 bg-terra/15 text-terra"
                    : "border-sand/40 bg-linen/60 text-bark/55"
                )}
              >
                {lang.short}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-[family-name:var(--font-syne)] text-sm font-bold">
                  {lang.native}
                </span>
                <span className="font-[family-name:var(--font-dm)] text-[0.65rem] text-bark/45">
                  {lang.english}
                </span>
              </span>
              {isActive && <Check className="ml-auto h-4 w-4 text-terra" strokeWidth={2.5} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

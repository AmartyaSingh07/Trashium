"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  Navbar as ResizableNavbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import { LogOut } from "lucide-react";
import PWAInstallButton from "@/components/ui/pwa-install-button";
import LanguageSwitcher from "@/components/ui/language-switcher";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  // Mirror ResizableNavbar's collapse threshold so we can hide the desktop
  // install button when the bar shrinks to its compact pill (avoids overlap
  // with the centered nav links).
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavCollapsed(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const supabase = useMemo(() => createClient(), []);

  // ─── Step 1: Get the authenticated user on mount ──────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!cancelled) setUser(authUser ?? null);
      } catch (err) {
        console.error("Navbar: failed to get user", err);
        if (!cancelled) setUser(null);
      }
    }

    fetchUser();

    // Listen for login / logout so `user` stays in sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled) {
          setUser(session?.user ?? null);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // ─── Step 2: Whenever `user` changes, fetch role with retry ───────
  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setRole(null);
      setVerifying(false);
      return;
    }

    setVerifying(true);
    setRole(null);

    async function fetchRoleWithRetry() {
      if (cancelled) return;

      console.log(`Navbar: fetching role for ${user!.email} (attempt 1)`);

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .match({ id: user!.id })
        .maybeSingle();

      // If there's a real error, default to household instead of crashing
      if (error) {
        console.warn("Navbar: profile query error, defaulting to household", error);
        if (!cancelled) {
          setRole("household");
          setVerifying(false);
        }
        return;
      }

      // If we got a role back, use it
      if (data?.role) {
        console.log("Navbar: role resolved →", data.role);
        if (!cancelled) {
          setRole(data.role);
          setVerifying(false);
        }
        return;
      }

      // Profile row hasn't synced yet — wait 3s and try one more time
      console.warn("Navbar: profile row not found, retrying in 3s...");
      await new Promise((r) => setTimeout(r, 3000));

      if (cancelled) return;

      console.log(`Navbar: fetching role for ${user!.email} (attempt 2 — final)`);

      const { data: retryData, error: retryError } = await supabase
        .from("profiles")
        .select("role")
        .match({ id: user!.id })
        .maybeSingle();

      if (retryError || !retryData?.role) {
        console.warn("Navbar: retry failed, defaulting to household");
        if (!cancelled) {
          setRole("household");
          setVerifying(false);
        }
        return;
      }

      console.log("Navbar: role resolved on retry →", retryData.role);
      if (!cancelled) {
        setRole(retryData.role);
        setVerifying(false);
      }
    }

    fetchRoleWithRetry();

    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  // ─── Logout ───────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    window.location.href = "/";
  };

  // ─── Helpers ──────────────────────────────────────────────────────
  // Hard-coded admin bypass while RLS issue is being debugged
  const isAdminByEmail = user?.email === "singhamartya07@gmail.com";
  const isAdmin = role === "admin" || isAdminByEmail;

  // Build role-aware navigation items
  const navItems = useMemo(() => {
    if (!user) {
      return [{ name: t("home"), link: "/", active: pathname === "/" }];
    }
    const currentRole = role || "household";
    if (currentRole === "admin" || isAdminByEmail) {
      return [
        { name: t("home"), link: "/", active: pathname === "/" },
        { name: t("adminHub"), link: "/admin", active: pathname === "/admin" },
      ];
    }
    if (currentRole === "crew" || currentRole === "collector") {
      return [
        { name: t("home"), link: "/", active: pathname === "/" },
        { name: t("crewHub"), link: "/crew", active: pathname === "/crew" },
      ];
    }
    // Default to household
    return [
      { name: t("home"), link: "/", active: pathname === "/" },
      { name: t("dashboard"), link: "/dashboard", active: pathname === "/dashboard" },
      { name: t("liveTracking"), link: "/dashboard/tracking", active: pathname === "/dashboard/tracking" },
      { name: t("marketplace"), link: "/marketplace", active: pathname === "/marketplace" },
      { name: t("myProfile"), link: "/profile", active: pathname === "/profile" },
    ];
  }, [user, role, isAdminByEmail, pathname, t]);

  // Client-side navigation handler for NavItems
  const handleNavClick = (link: string) => {
    router.push(link);
  };

  return (
    <div className="relative w-full">
      <ResizableNavbar>
        {/* ─── Desktop Navigation ─────────────────────────────── */}
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} onItemClick={handleNavClick} />
          <div className="flex items-center gap-3">
            {/* On the compact (scrolled) pill, collapse to an icon-only button so
                it never overlaps the centered nav links. Mobile keeps its own
                full-width button below. */}
            <LanguageSwitcher iconOnly={navCollapsed} />
            <PWAInstallButton iconOnly={navCollapsed} />
            {user ? (
              <>
                {verifying && !isAdmin && (
                  <span className="text-[10px] text-terra animate-pulse font-mono uppercase tracking-wider">
                    {tc("verifying")}
                  </span>
                )}
                <NavbarButton
                  as="button"
                  variant="ghost"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {tc("logout")}
                </NavbarButton>
              </>
            ) : (
              <>
                <NavbarButton
                  as="button"
                  variant="secondary"
                  onClick={() => router.push("/login")}
                >
                  {tc("login")}
                </NavbarButton>
                <NavbarButton
                  as="button"
                  variant="primary"
                  onClick={() => router.push("/signup")}
                >
                  {tc("joinMovement")}
                </NavbarButton>
              </>
            )}
          </div>
        </NavBody>

        {/* ─── Mobile Navigation ──────────────────────────────── */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <MobileNavToggle
              isOpen={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            />
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={mobileOpen}
            onClose={() => setMobileOpen(false)}
          >
            {navItems.map((item, idx) => (
              <Link
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setMobileOpen(false)}
                className={`t-focus-ring relative w-full py-2 font-[family-name:var(--font-dm)] text-[0.6875rem] font-medium uppercase tracking-wide transition-colors duration-200 ${
                  item.active
                    ? "text-terra border-l-2 border-terra pl-3"
                    : "text-bark/70 hover:text-terra pl-3"
                }`}
              >
                {item.name}
              </Link>
            ))}

            <div className="flex w-full flex-col gap-3 mt-2 pt-4 border-t border-terra/10">
              <LanguageSwitcher fullWidth />
              <PWAInstallButton className="w-full" buttonClassName="w-full justify-center" />
              {user ? (
                <NavbarButton
                  as="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  variant="ghost"
                  className="w-full justify-start gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {tc("logout")}
                </NavbarButton>
              ) : (
                <>
                  <NavbarButton
                    as="button"
                    onClick={() => {
                      setMobileOpen(false);
                      router.push("/login");
                    }}
                    variant="secondary"
                    className="w-full"
                  >
                    {tc("login")}
                  </NavbarButton>
                  <NavbarButton
                    as="button"
                    onClick={() => {
                      setMobileOpen(false);
                      router.push("/signup");
                    }}
                    variant="primary"
                    className="w-full"
                  >
                    {tc("joinMovement")}
                  </NavbarButton>
                </>
              )}
            </div>
          </MobileNavMenu>
        </MobileNav>
      </ResizableNavbar>
    </div>
  );
}

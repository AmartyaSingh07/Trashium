"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Download, Share, Plus, X, MoreVertical } from "lucide-react";

/** The beforeinstallprompt event (not in the TS DOM lib by default). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Module-level capture of beforeinstallprompt.
 * The browser can fire this event BEFORE React mounts the component, in which
 * case a listener added inside useEffect would miss it forever (the classic
 * reason an install button "never appears"). We attach a listener at import
 * time so the event is captured no matter when it fires, then the component
 * reads/subscribes to this shared value.
 */
let capturedPrompt: BeforeInstallPromptEvent | null = null;
const promptSubscribers = new Set<(e: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    capturedPrompt = e as BeforeInstallPromptEvent;
    promptSubscribers.forEach((fn) => fn(capturedPrompt));
  });
  window.addEventListener("appinstalled", () => {
    capturedPrompt = null;
    promptSubscribers.forEach((fn) => fn(null));
  });
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch.
  const iPadOS =
    navigator.platform === "MacIntel" &&
    typeof document !== "undefined" &&
    "ontouchend" in document;
  return iOSDevice || iPadOS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

interface PWAInstallButtonProps {
  className?: string;
  /** Extra classes for the button itself (lets the navbar size it). */
  buttonClassName?: string;
  /** Collapse to just the download icon (used by the compact scrolled navbar). */
  iconOnly?: boolean;
}

type HelpKind = null | "ios" | "android" | "desktop";

export default function PWAInstallButton({
  className = "",
  buttonClassName = "",
  iconOnly = false,
}: PWAInstallButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState<HelpKind>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only mount gate + install-env detection; must run once after hydration
    setMounted(true);
    setIos(isIos());
    setInstalled(isStandalone());
    // Pick up a prompt that may already have been captured before mount.
    setDeferred(capturedPrompt);

    // Subscribe to future prompt captures / appinstalled clears.
    const onPrompt = (e: BeforeInstallPromptEvent | null) => setDeferred(e);
    promptSubscribers.add(onPrompt);

    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onMq = () => setInstalled(isStandalone());
    mq?.addEventListener?.("change", onMq);

    const onAppInstalled = () => {
      setInstalled(true);
      setHelp(null);
    };
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      promptSubscribers.delete(onPrompt);
      mq?.removeEventListener?.("change", onMq);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const showFallbackHelp = useCallback(() => {
    if (ios) {
      setHelp("ios");
    } else if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) {
      setHelp("android");
    } else {
      setHelp("desktop");
    }
  }, [ios]);

  const handleClick = useCallback(async () => {
    console.log("[PWA] install button clicked. hasDeferredPrompt =", !!deferred, "| ios =", ios);
    // 1) Native prompt available (Android / desktop Chromium that fired the event).
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
        } else {
          // Dismissed (or no dialog shown) — give the user a manual path instead
          // of leaving the click feeling dead.
          showFallbackHelp();
        }
        setDeferred(null);
        capturedPrompt = null;
      } catch (err) {
        // prompt() can reject if it was already used / throttled by Chrome.
        // Fall back to instructions so the button is never a dead end.
        console.warn("PWA prompt() failed, showing manual instructions:", err);
        setDeferred(null);
        capturedPrompt = null;
        showFallbackHelp();
      }
      return;
    }
    // 2) No native prompt captured — always show platform-appropriate instructions.
    showFallbackHelp();
  }, [deferred, showFallbackHelp]);

  // Render nothing until mounted (avoids hydration mismatch) and never show once
  // the app is already installed/running standalone.
  if (!mounted) return null;
  if (installed) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Install Trashium app"
        title="Install Trashium app"
        className={
          "inline-flex items-center justify-center rounded-full bg-[#2A2218] " +
          "font-[family-name:var(--font-syne)] text-[0.6875rem] font-bold uppercase tracking-wider " +
          "text-[#F4EFE3] shadow-sm transition-all duration-200 hover:bg-[#C2793D] " +
          "focus:outline-none focus:ring-2 focus:ring-[#C2793D]/50 " +
          (iconOnly ? "h-9 w-9 p-0 gap-0 " : "gap-2 px-4 py-2 ") +
          buttonClassName
        }
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        {!iconOnly && "Install App"}
      </button>

      {help && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#2A2218]/40 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="How to install Trashium"
          onClick={() => setHelp(null)}
        >
          <div
            className="m-4 w-full max-w-sm rounded-2xl border border-[#C2793D]/30 bg-[#F4EFE3] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-[#2A2218]">
                Install Trashium
              </h3>
              <button
                type="button"
                onClick={() => setHelp(null)}
                aria-label="Close"
                className="rounded-full p-1 text-[#6B5744] hover:bg-[#2A2218]/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 font-[family-name:var(--font-dm)] text-[13px] leading-relaxed text-[#6B5744]">
              Add Trashium to your device for a full-screen, app-like experience.
            </p>

            <ol className="space-y-3">
              {help === "ios" && (
                <>
                  <Step n={1}>
                    Tap the <Share className="inline h-4 w-4 text-[#C2793D]" /> Share
                    button in Safari
                  </Step>
                  <Step n={2}>
                    Scroll and choose{" "}
                    <span className="font-semibold">Add to Home Screen</span>{" "}
                    <Plus className="inline h-4 w-4 text-[#C2793D]" />
                  </Step>
                  <Step n={3}>
                    Tap <span className="font-semibold">Add</span> — done!
                  </Step>
                </>
              )}

              {help === "android" && (
                <>
                  <Step n={1}>
                    Tap the <MoreVertical className="inline h-4 w-4 text-[#C2793D]" />{" "}
                    menu in your browser
                  </Step>
                  <Step n={2}>
                    Choose{" "}
                    <span className="font-semibold">
                      Install app / Add to Home screen
                    </span>
                  </Step>
                  <Step n={3}>
                    Confirm <span className="font-semibold">Install</span> — done!
                  </Step>
                </>
              )}

              {help === "desktop" && (
                <>
                  <Step n={1}>
                    Look for the install{" "}
                    <Download className="inline h-4 w-4 text-[#C2793D]" /> icon at the
                    right of the address bar
                  </Step>
                  <Step n={2}>
                    Or open the browser{" "}
                    <MoreVertical className="inline h-4 w-4 text-[#C2793D]" /> menu and
                    choose <span className="font-semibold">Install Trashium</span>
                  </Step>
                  <Step n={3}>
                    Confirm <span className="font-semibold">Install</span> — done!
                  </Step>
                </>
              )}
            </ol>

            {help === "desktop" && (
              <p className="mt-4 font-[family-name:var(--font-dm)] text-[11px] leading-relaxed text-[#6B5744]/80">
                Tip: installation works in Chrome, Edge, and other Chromium browsers
                over HTTPS or on localhost.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8FA57E]/20 font-[family-name:var(--font-jetbrains)] text-[12px] font-bold text-[#4A6741]">
        {n}
      </span>
      <span className="font-[family-name:var(--font-dm)] text-[13px] text-[#2A2218]">
        {children}
      </span>
    </li>
  );
}

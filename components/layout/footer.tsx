import Link from "next/link";
import { Leaf } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const footerLinks = {
  Platform: [
    { label: "How it Works", href: "/#how-it-works" },
  ],
  Company: [
    { label: "About Us", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Blog", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-terra/10 bg-linen/90 backdrop-blur-md relative z-10">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-terra text-white transition-transform group-hover:scale-105">
                <Leaf className="h-4.5 w-4.5" />
              </div>
              <span className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark">
                Trashium
              </span>
            </Link>
            <p className="text-sm text-smoke leading-relaxed font-[family-name:var(--font-dm)]">
              Turning waste into worth. Join the movement towards a sustainable
              future, one conscious choice at a time.
            </p>
          </div>

          {/* Link Groups */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title} className="flex flex-col gap-3">
              <h3 className="t-label text-bark font-bold tracking-wider">
                {title}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => {
                  const isHowItWorks = link.label === "How it Works";
                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className={
                          isHowItWorks
                            ? "text-slate-600 hover:text-emerald-600 transition-colors duration-150 text-sm text-left block py-1 font-[family-name:var(--font-dm)]"
                            : "text-sm text-smoke transition-colors hover:text-terra font-[family-name:var(--font-dm)]"
                        }
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8 bg-sand/35" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-smoke font-[family-name:var(--font-dm)]">
            © {new Date().getFullYear()} Trashium. All rights
            reserved. Final Year B.Tech Capstone.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-smoke font-[family-name:var(--font-dm)]">
            <span>Crafted with care for</span>
            <span className="text-terra animate-pulse">✦</span>
            <span>our shared environment</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

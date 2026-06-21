import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

/**
 * Shared chrome for the footer-linked informational pages (About, Careers, Blog,
 * and the three legal pages). Keeps the Navbar → main → Footer composition
 * identical to app/page.tsx so these routes feel native to the site.
 */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

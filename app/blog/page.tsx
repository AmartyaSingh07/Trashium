import type { Metadata } from "next";
import PageShell from "@/components/layout/page-shell";
import BlogContent from "./blog-content";

export const metadata: Metadata = {
  title: "Blog — Trashium",
  description:
    "A scroll-through showcase of the Trashium platform — the household app, crew hub, and admin console, live across West Bengal.",
};

export default function BlogPage() {
  return (
    <PageShell>
      <BlogContent />
    </PageShell>
  );
}

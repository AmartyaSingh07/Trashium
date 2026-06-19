import { KineticTypographyLoader } from '@/components/ui/loading-animation';

/**
 * Root loading UI (Next.js App Router).
 * Renders automatically during route-segment navigation/streaming across the
 * whole app. The loader is a fixed full-screen overlay (z-9999), so it sits
 * above the page content and the persistent Ribbons/grain layers.
 */
export default function Loading() {
  return <KineticTypographyLoader />;
}

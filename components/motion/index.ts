// Barrel for the shared motion primitives. GsapProvider is imported directly
// from './gsap-provider' (it mounts once in the layout, not per-consumer).
export { Reveal, type RevealProps } from "./reveal";
export {
  Stagger,
  StaggerItem,
  type StaggerProps,
  type StaggerItemProps,
} from "./stagger";
export { KineticHeading, type KineticHeadingProps } from "./kinetic-heading";

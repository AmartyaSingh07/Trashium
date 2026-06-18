"use client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";

import React, { useRef, useState } from "react";


interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: {
    name: string;
    link: string;
    active?: boolean;
  }[];
  className?: string;
  onItemClick?: (link: string) => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 100) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  });

  return (
    <motion.div
      ref={ref}
      className={cn("fixed inset-x-0 top-0 z-50 w-full", className)}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(16px) saturate(1.4)" : "blur(12px) saturate(1.2)",
        boxShadow: visible
          ? "0 4px 24px rgba(42,34,24, 0.08), 0 1px 0 rgba(194,112,61, 0.1) inset"
          : "0 1px 0 rgba(194,112,61, 0.08)",
        width: visible ? "40%" : "100%",
        y: visible ? 12 : 0,
        borderRadius: visible ? "9999px" : "0px",
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      style={{
        minWidth: "800px",
      }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full max-w-7xl flex-row items-center justify-between self-start px-6 py-3 lg:flex",
        visible
          ? "bg-linen/90 border border-terra/15"
          : "bg-linen/85 border-b border-terra/10",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-1 lg:flex",
        className,
      )}
    >
      {items.map((item, idx) => (
        <a
          onMouseEnter={() => setHovered(idx)}
          onClick={(e) => {
            e.preventDefault();
            onItemClick?.(item.link);
          }}
          className={cn(
            "relative px-4 py-2 text-sm cursor-pointer transition-colors duration-200",
            "font-[family-name:var(--font-dm)] font-medium tracking-wide uppercase text-[0.6875rem] leading-none",
            item.active
              ? "text-terra"
              : "text-bark/70 hover:text-bark",
          )}
          key={`link-${idx}`}
          href={item.link}
        >
          {hovered === idx && (
            <motion.div
              layoutId="hovered"
              className="absolute inset-0 h-full w-full rounded-full bg-terra/8"
            />
          )}
          <span className="relative z-20">{item.name}</span>
          {item.active && (
            <motion.div
              layoutId="active-indicator"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-4 rounded-full bg-terra"
            />
          )}
        </a>
      ))}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(16px) saturate(1.4)" : "blur(12px) saturate(1.2)",
        boxShadow: visible
          ? "0 4px 24px rgba(42,34,24, 0.08), 0 1px 0 rgba(194,112,61, 0.1) inset"
          : "0 1px 0 rgba(194,112,61, 0.08)",
        width: visible ? "92%" : "100%",
        paddingRight: visible ? "12px" : "0px",
        paddingLeft: visible ? "12px" : "0px",
        borderRadius: visible ? "16px" : "0px",
        y: visible ? 12 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between px-4 py-3 lg:hidden",
        visible
          ? "bg-linen/90 border border-terra/15"
          : "bg-linen/85 border-b border-terra/10",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "absolute inset-x-0 top-16 z-50 flex w-full flex-col items-start justify-start gap-4 rounded-2xl bg-linen/98 backdrop-blur-xl px-5 py-6 border border-terra/12 shadow-[0_8px_32px_rgba(42,34,24,0.12)]",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return isOpen ? (
    <IconX className="h-5 w-5 text-bark cursor-pointer hover:text-terra transition-colors" onClick={onClick} />
  ) : (
    <IconMenu2 className="h-5 w-5 text-bark cursor-pointer hover:text-terra transition-colors" onClick={onClick} />
  );
};

export const NavbarLogo = () => {
  return (
    <Link href="/" className="flex items-center gap-2.5 group select-none cursor-pointer">
      {/* High-Contrast Brand Graphic Container Frame */}
      <div className="w-9 h-9 rounded-xl bg-[#EDE5D8]/50 border border-[rgba(194,112,61,0.15)] p-1.5 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105 shadow-sm">
        <img 
          src="/brand/trashium-icon-static.svg"
          alt="Trashium Logo"
          className="w-full h-full object-contain filter drop-shadow-[0_1px_2px_rgba(42,34,24,0.15)]"
        />
      </div>
      
      {/* Aligned Typography Stack */}
      <span className="font-syne font-bold text-lg text-[#2A2218] tracking-tight group-hover:text-[#C2703D] transition-colors">
        Trashium
      </span>
    </Link>
  );
};

export const NavbarButton = ({
  href,
  as: Tag = "a",
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "ghost";
} & (
  | React.ComponentPropsWithoutRef<"a">
  | React.ComponentPropsWithoutRef<"button">
)) => {
  const baseStyles =
    "px-4 py-2 rounded-lg text-sm font-bold relative cursor-pointer hover:-translate-y-0.5 transition-all duration-200 inline-flex items-center justify-center gap-2 font-[family-name:var(--font-syne)] text-xs uppercase tracking-wider";

  const variantStyles = {
    primary:
      "bg-terra text-linen hover:bg-terra-deep shadow-[0_2px_8px_rgba(194,112,61,0.25)]",
    secondary:
      "bg-parchment text-bark border border-terra/15 hover:bg-terra/10 hover:text-terra shadow-none",
    dark:
      "bg-bark text-linen hover:bg-black shadow-[0_2px_8px_rgba(42,34,24,0.2)]",
    ghost:
      "bg-transparent text-smoke hover:bg-terra/10 hover:text-terra shadow-none",
  };

  return (
    <Tag
      href={href || undefined}
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    >
      {children}
    </Tag>
  );
};

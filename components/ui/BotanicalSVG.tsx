// components/ui/BotanicalSVG.tsx
import React from 'react';

export default function BotanicalSVG({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 400"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {/* Central stem */}
      <path d="M150 380 C150 300 140 220 155 80" stroke="#C4704A" strokeWidth="1.5" fill="none" opacity="0.18" strokeLinecap="round"/>
      {/* Left branch cluster */}
      <path d="M148 200 C120 190 90 175 70 155" stroke="#7A9E7E" strokeWidth="1.2" fill="none" opacity="0.20" strokeLinecap="round"/>
      <path d="M70 155 C55 145 42 138 38 125" stroke="#7A9E7E" strokeWidth="1" fill="none" opacity="0.18" strokeLinecap="round"/>
      <ellipse cx="52" cy="130" rx="14" ry="9" fill="none" stroke="#7A9E7E" strokeWidth="1" opacity="0.22" transform="rotate(-30 52 130)"/>
      <ellipse cx="75" cy="148" rx="16" ry="10" fill="none" stroke="#7A9E7E" strokeWidth="1" opacity="0.20" transform="rotate(-25 75 148)"/>
      {/* Right branch cluster */}
      <path d="M152 240 C178 228 210 215 228 196" stroke="#C4704A" strokeWidth="1.2" fill="none" opacity="0.16" strokeLinecap="round"/>
      <ellipse cx="220" cy="200" rx="18" ry="11" fill="none" stroke="#C4704A" strokeWidth="1" opacity="0.18" transform="rotate(20 220 200)"/>
      <ellipse cx="235" cy="188" rx="12" ry="8" fill="none" stroke="#C4704A" strokeWidth="1" opacity="0.14" transform="rotate(15 235 188)"/>
      {/* Upper left leaves */}
      <path d="M153 140 C128 128 105 118 88 100" stroke="#D9BA8E" strokeWidth="1.2" fill="none" opacity="0.22" strokeLinecap="round"/>
      <ellipse cx="92" cy="103" rx="20" ry="12" fill="none" stroke="#D9BA8E" strokeWidth="1" opacity="0.24" transform="rotate(-40 92 103)"/>
      <ellipse cx="108" cy="115" rx="15" ry="9" fill="none" stroke="#D9BA8E" strokeWidth="1" opacity="0.20" transform="rotate(-35 108 115)"/>
      {/* Top flourish */}
      <path d="M155 80 C148 60 152 40 158 22" stroke="#C4704A" strokeWidth="1.2" fill="none" opacity="0.14" strokeLinecap="round"/>
      <circle cx="158" cy="20" r="4" fill="none" stroke="#C4704A" strokeWidth="1" opacity="0.18"/>
      {/* Small detail dots */}
      <circle cx="130" cy="165" r="2" fill="#7A9E7E" opacity="0.20"/>
      <circle cx="175" cy="210" r="2" fill="#C4704A" opacity="0.16"/>
      <circle cx="115" cy="108" r="2" fill="#D9BA8E" opacity="0.24"/>
    </svg>
  );
}

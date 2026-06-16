// components/ui/StatCard.tsx
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  delay?: 1 | 2 | 3 | 4;
}

export default function StatCard({ label, value, unit, icon, delay }: StatCardProps) {
  const delayClass = delay ? `animate-fade-up-delay-${delay}` : 'animate-fade-up';
  return (
    <div className={`t-glass-card p-5 hover:shadow-[var(--t-shadow-lg)] transition-shadow duration-300 ${delayClass}`}>
      <div className="w-10 h-10 rounded-xl bg-terra/10 flex items-center justify-center text-terra mb-4">
        {icon}
      </div>
      <div className="t-stat text-bark tabular-nums">
        {value}
        {unit && (
          <span className="text-lg font-[family-name:var(--font-dm)] text-clay ml-1">
            {unit}
          </span>
        )}
      </div>
      <p className="t-label text-smoke mt-1">{label}</p>
    </div>
  );
}

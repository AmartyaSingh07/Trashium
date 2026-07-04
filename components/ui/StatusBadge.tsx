// components/ui/StatusBadge.tsx
import React from 'react';

export default function StatusBadge({ status }: { status: string }) {
  if (status === 'collected') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-[#8FA37E]/10 text-[#4A6741] border border-[#8FA37E]/20 font-medium text-xs rounded px-2.5 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
        Collected
      </span>
    );
  }

  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-destructive/10 text-destructive border border-destructive/20 font-medium text-xs rounded px-2.5 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
        Cancelled
      </span>
    );
  }

  type PickupStatus = 'pending' | 'accepted' | 'completed';

  const statusMap: Record<PickupStatus, { className: string; label: string }> = {
    pending:   { className: 'status-pending',   label: 'Pending' },
    accepted:  { className: 'status-accepted',  label: 'Accepted' },
    completed: { className: 'status-completed', label: 'Completed' },
  };

  // Fallback to 'pending' for any unknown status value.
  let mappedStatus: PickupStatus = 'pending';
  if (status === 'accepted') {
    mappedStatus = 'accepted';
  } else if (status === 'completed') {
    mappedStatus = 'completed';
  }

  const { className, label } = statusMap[mappedStatus];
  return (
    <span className={className}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

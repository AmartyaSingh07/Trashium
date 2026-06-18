"use client";

import { Skeleton } from "boneyard-js/react";

const B = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-parchment ${className}`} />
);

function CrewSkeleton() {
  return (
    <div className="min-h-screen bg-linen">
      {/* Crew navbar — minimal */}
      <div className="h-16 border-b border-sand/30 px-6 flex items-center gap-4 bg-linen/80">
        <B className="h-8 w-8 rounded-full" />
        <B className="h-5 w-28" />
        <div className="flex-1" />
        <B className="h-6 w-24 rounded-full" />
        <B className="h-8 w-8 rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Page title + date */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <B className="h-7 w-40" />
            <B className="h-4 w-28" />
          </div>
          <B className="h-9 w-32 rounded-lg" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-sand/30 bg-parchment/40 p-4 space-y-2">
              <B className="h-3 w-16" />
              <B className="h-7 w-12" />
            </div>
          ))}
        </div>

        {/* Map block */}
        <div className="rounded-xl border border-sand/30 bg-parchment/40 overflow-hidden">
          <B className="h-72 w-full rounded-none" />
        </div>

        {/* Pickup list */}
        <div className="rounded-xl border border-sand/30 bg-parchment/40 p-4 space-y-3">
          <B className="h-5 w-32 mb-2" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-sand/20 last:border-0">
              <B className="h-12 w-12 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <B className="h-4 w-36" />
                <B className="h-3 w-24" />
              </div>
              <B className="h-4 w-20" />
              <B className="h-8 w-8 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CrewLoading() {
  return (
    <Skeleton name="crew-dashboard" loading={true} fallback={<CrewSkeleton />}>
      {null}
    </Skeleton>
  );
}

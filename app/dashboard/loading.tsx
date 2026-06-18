"use client";

import { Skeleton } from "boneyard-js/react";

const B = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-parchment ${className}`} />
);

function NavSkeleton() {
  return (
    <div className="h-16 border-b border-sand/30 px-6 flex items-center gap-4 bg-linen/80">
      <B className="h-8 w-8 rounded-full" />
      <B className="h-5 w-28" />
      <div className="flex-1" />
      <B className="h-8 w-20 rounded-lg" />
      <B className="h-8 w-8 rounded-full" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-linen">
      <NavSkeleton />

      {/* Hero strip */}
      <div className="px-6 py-8 border-b border-sand/20">
        <B className="h-8 w-48 mb-2" />
        <B className="h-4 w-72" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats cards row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-sand/30 bg-parchment/40 p-4 space-y-3">
              <B className="h-4 w-20" />
              <B className="h-8 w-16" />
              <B className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Two-column content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pickups list — 2/3 width */}
          <div className="lg:col-span-2 rounded-xl border border-sand/30 bg-parchment/40 p-4 space-y-3">
            <B className="h-5 w-32 mb-4" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <B className="h-10 w-10 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <B className="h-4 w-40" />
                  <B className="h-3 w-24" />
                </div>
                <B className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>

          {/* Streak widget — 1/3 width */}
          <div className="rounded-xl border border-sand/30 bg-parchment/40 p-4 space-y-4">
            <B className="h-5 w-28" />
            <B className="h-24 w-24 rounded-full mx-auto" />
            <B className="h-4 w-32 mx-auto" />
            <div className="grid grid-cols-7 gap-1">
              {[...Array(7)].map((_, i) => (
                <B key={i} className="h-7 rounded-md" />
              ))}
            </div>
            <B className="h-10 w-full rounded-lg" />
          </div>
        </div>

        {/* Badges strip */}
        <div className="rounded-xl border border-sand/30 bg-parchment/40 p-4">
          <B className="h-5 w-24 mb-4" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2">
                <B className="h-14 w-14 rounded-full" />
                <B className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <Skeleton name="dashboard" loading={true} fallback={<DashboardSkeleton />}>
      {null}
    </Skeleton>
  );
}

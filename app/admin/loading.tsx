"use client";

import { Skeleton } from "boneyard-js/react";

const B = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-parchment ${className}`} />
);

function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-linen">
      {/* Navbar */}
      <div className="h-16 border-b border-sand/30 px-6 flex items-center gap-4 bg-linen/80">
        <B className="h-8 w-8 rounded-full" />
        <B className="h-5 w-28" />
        <div className="flex-1" />
        <B className="h-6 w-16 rounded-full" />
        <B className="h-8 w-8 rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Page heading */}
        <div className="space-y-2">
          <B className="h-8 w-36" />
          <B className="h-4 w-52" />
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 border-b border-sand/30 pb-0">
          {[...Array(4)].map((_, i) => (
            <B key={i} className="h-10 w-28 rounded-t-lg rounded-b-none" />
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-sand/30 bg-parchment/40 p-4 space-y-2">
              <B className="h-3 w-20" />
              <B className="h-7 w-12" />
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-sand/30 bg-parchment/40 overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-sand/30">
            <B className="h-4 w-10" /><B className="h-4 w-28" /><B className="h-4 w-20" />
            <B className="h-4 w-20" /><B className="h-4 w-20" /><B className="h-4 w-14" />
          </div>
          {/* Table rows */}
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-sand/20 last:border-0">
              <B className="h-4 w-10" /><B className="h-4 w-28" /><B className="h-4 w-20" />
              <B className="h-4 w-20" /><B className="h-4 w-20" /><B className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminLoading() {
  return (
    <Skeleton name="admin-hub" loading={true} fallback={<AdminSkeleton />}>
      {null}
    </Skeleton>
  );
}

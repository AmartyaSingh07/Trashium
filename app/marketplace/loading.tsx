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

function MarketplaceSkeleton() {
  return (
    <div className="min-h-screen bg-linen">
      <NavSkeleton />

      {/* Header */}
      <div className="px-6 py-8 border-b border-sand/20 flex items-center justify-between">
        <div className="space-y-2">
          <B className="h-8 w-40" />
          <B className="h-4 w-56" />
        </div>
        <div className="rounded-xl border border-sand/30 bg-parchment/40 px-4 py-2 flex items-center gap-2">
          <B className="h-5 w-5 rounded" />
          <B className="h-6 w-20" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tier tabs */}
        <div className="flex gap-2 mb-8">
          {[...Array(4)].map((_, i) => (
            <B key={i} className="h-9 w-20 rounded-full" />
          ))}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-sand/30 bg-parchment/40 overflow-hidden">
              <B className="h-44 w-full rounded-none" />
              <div className="p-4 space-y-3">
                <B className="h-5 w-36" />
                <B className="h-3 w-full" />
                <B className="h-3 w-4/5" />
                <div className="flex items-center justify-between pt-1">
                  <B className="h-6 w-20 rounded-full" />
                  <B className="h-9 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MarketplaceLoading() {
  return (
    <Skeleton name="marketplace" loading={true} fallback={<MarketplaceSkeleton />}>
      {null}
    </Skeleton>
  );
}

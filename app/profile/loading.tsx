"use client";

import { Skeleton } from "boneyard-js/react";

const B = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-parchment ${className}`} />
);

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-linen">
      {/* Navbar */}
      <div className="h-16 border-b border-sand/30 px-6 flex items-center gap-4 bg-linen/80">
        <B className="h-8 w-8 rounded-full" />
        <B className="h-5 w-28" />
        <div className="flex-1" />
        <B className="h-8 w-20 rounded-lg" />
        <B className="h-8 w-8 rounded-full" />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Profile card */}
        <div className="rounded-xl border border-sand/30 bg-parchment/40 p-6 flex items-start gap-6">
          <B className="h-20 w-20 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <B className="h-6 w-40" />
            <B className="h-4 w-56" />
            <B className="h-4 w-32" />
            <div className="flex gap-2 pt-1">
              <B className="h-7 w-20 rounded-full" />
              <B className="h-7 w-24 rounded-full" />
            </div>
          </div>
          <B className="h-9 w-24 rounded-lg flex-shrink-0" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-sand/30 bg-parchment/40 p-4 space-y-2">
              <B className="h-3 w-20" />
              <B className="h-7 w-14" />
            </div>
          ))}
        </div>

        {/* Badges grid */}
        <div className="rounded-xl border border-sand/30 bg-parchment/40 p-4">
          <B className="h-5 w-24 mb-4" />
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <B className="h-12 w-12 rounded-full" />
                <B className="h-2 w-10" />
              </div>
            ))}
          </div>
        </div>

        {/* Edit form fields placeholder */}
        <div className="rounded-xl border border-sand/30 bg-parchment/40 p-4 space-y-4">
          <B className="h-5 w-36" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <B className="h-3 w-20" />
              <B className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProfileLoading() {
  return (
    <Skeleton name="profile" loading={true} fallback={<ProfileSkeleton />}>
      {null}
    </Skeleton>
  );
}

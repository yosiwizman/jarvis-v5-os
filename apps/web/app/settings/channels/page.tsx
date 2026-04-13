"use client";

// G-T06.D14: Channels category landing page.
//
// The former flat grid that mixed Email / Messages / iMessage placeholder
// tiles is now split into three category subpages per docs/plans/
// G-T06.D13-channels-ia-plan.md. This file renders the landing hub —
// three category cards with live connected-account counts — and routes
// each card to its dedicated subpage:
//
//   /settings/channels/email      (D15 — Gmail, Yahoo, Outlook, future iCloud)
//   /settings/channels/messages   (D16 — WhatsApp, iMessage placeholder)
//   /settings/channels/phone      (D17 — placeholder / roadmap)
//
// The existing `ChannelProviderSection`, `ChannelAccountCard`, and
// provider descriptor map live in `./shared.tsx` so both this landing and
// the upcoming subpages import from one place without duplication.

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Route } from "next";

type CategoryCount = {
  providers: number;
  connectedAccounts: number;
  totalAccounts: number;
};

type CountsResponse = {
  email: CategoryCount;
  messages: CategoryCount;
  phone: CategoryCount;
};

const EMPTY_COUNT: CategoryCount = { providers: 0, connectedAccounts: 0, totalAccounts: 0 };

type CategoryCardProps = {
  href: Route;
  icon: string;
  title: string;
  description: string;
  count: CategoryCount;
  comingSoon?: boolean;
  testId: string;
};

function ConnectedBadge({ count, comingSoon }: { count: CategoryCount; comingSoon?: boolean }) {
  if (comingSoon) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border bg-white/5 text-white/50 border-white/20">
        Coming soon
      </span>
    );
  }
  const hasConnection = count.connectedAccounts > 0;
  const label =
    count.providers === 0
      ? "No providers"
      : count.totalAccounts === 0
        ? `0 of ${count.providers} connected`
        : `${count.connectedAccounts} of ${count.totalAccounts} connected`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${
        hasConnection
          ? "bg-green-500/20 text-green-300 border-green-500/40"
          : "bg-white/5 text-white/60 border-white/20"
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          hasConnection ? "bg-green-400" : "bg-white/30"
        }`}
      />
      {label}
    </span>
  );
}

function CategoryCard({ href, icon, title, description, count, comingSoon, testId }: CategoryCardProps) {
  const inner = (
    <div
      data-testid={testId}
      className={`card p-6 space-y-4 border rounded-lg transition-colors h-full flex flex-col ${
        comingSoon
          ? "border-white/10 bg-white/2 cursor-default"
          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-3xl" aria-hidden>
          {icon}
        </span>
        <ConnectedBadge count={count} comingSoon={comingSoon} />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/60">{description}</p>
      </div>
      <div className="grow" />
      {!comingSoon && (
        <div className="text-sm text-blue-300 hover:text-blue-200 font-medium">
          Manage →
        </div>
      )}
      {comingSoon && <div className="text-sm text-white/30">Planned for a future release</div>}
    </div>
  );

  if (comingSoon) {
    return inner;
  }
  // Use Next Link for client-side navigation once subpages exist. Until D15/
  // D16/D17 ship the subpages, clicking these will land on a 404 — that's
  // expected and documented in D14's scope guardrails.
  return (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  );
}

export default function ChannelsLandingPage() {
  const [counts, setCounts] = useState<CountsResponse | null>(null);

  const refetch = useCallback(() => {
    fetch("/api/channels/counts")
      .then((r) => r.json())
      .then((data: CountsResponse) => setCounts(data))
      .catch(() => {
        // Fall back to an empty structure so the UI still renders.
        setCounts({ email: EMPTY_COUNT, messages: EMPTY_COUNT, phone: EMPTY_COUNT });
      });
  }, []);

  useEffect(() => {
    refetch();
    const t = setInterval(refetch, 15000);
    return () => clearInterval(t);
  }, [refetch]);

  const email = counts?.email ?? EMPTY_COUNT;
  const messages = counts?.messages ?? EMPTY_COUNT;
  const phone = counts?.phone ?? EMPTY_COUNT;

  return (
    <div className="space-y-6" data-testid="channels-landing-page">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Channels</h1>
        <p className="text-sm text-white/60">
          Where AKIOR connects to your accounts and apps. Pick a category to manage its providers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CategoryCard
          href="/settings/channels/email"
          testId="channels-category-email"
          icon="📧"
          title="Email"
          description="Google, Yahoo, Outlook. Read-only inbox access through managed-browser sessions."
          count={email}
        />
        <CategoryCard
          href="/settings/channels/messages"
          testId="channels-category-messages"
          icon="💬"
          title="Messages"
          description="WhatsApp today; iMessage planned. Chat accounts linked via QR scan or native app bridges."
          count={messages}
        />
        <CategoryCard
          href="/settings/channels/phone"
          testId="channels-category-phone"
          icon="📞"
          title="Phone & Voice"
          description="Google Voice, Twilio console, and more. Coming in a future release."
          count={phone}
          comingSoon
        />
      </div>
    </div>
  );
}

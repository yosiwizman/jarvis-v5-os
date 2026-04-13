"use client";

// G-T06.D15: real Email subpage.
//
// Renders one ProviderCluster per email-category provider (Gmail, Yahoo,
// Outlook) driven by the shared client-side UI_PROVIDERS map. Future
// email providers (iCloud in D18, any additional D19+ entries) appear
// automatically as soon as their descriptors are tagged category:"email".
//
// The server side is unchanged — D6/D7/D8/D9/D10/D11/D12 account
// lifecycle routes (/api/channels/:providerId/*) serve every cluster
// through the shared browser-session adapter. No provider runtime work
// happens in this slice.

import React from "react";
import {
  ProviderCluster,
  SubpageHeader,
  listUiProvidersByCategory,
} from "../shared";

export default function EmailSubpage() {
  const providers = listUiProvidersByCategory("email");
  return (
    <div className="space-y-6" data-testid="channels-email-subpage">
      <SubpageHeader
        backHref="/settings/channels"
        backLabel="Back to Channels"
        title="Email"
        description="Your email accounts, connected through managed-browser sessions. No credentials stored."
      />
      {providers.length === 0 ? (
        <div className="card p-6 border border-white/10 rounded-lg bg-white/5 text-sm text-white/60">
          No email providers are registered yet.
        </div>
      ) : (
        <div className="space-y-8">
          {providers.map((descriptor) => (
            <ProviderCluster key={descriptor.providerId} providerId={descriptor.providerId} />
          ))}
        </div>
      )}
    </div>
  );
}

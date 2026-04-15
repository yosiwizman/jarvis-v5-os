"use client";

import React from "react";
import {
  ProviderCluster,
  SubpageHeader,
  listUiProvidersByCategory,
} from "../shared";

export default function DriveSubpage() {
  const providers = listUiProvidersByCategory("files");
  return (
    <div className="space-y-6" data-testid="channels-drive-subpage">
      <SubpageHeader
        backHref="/settings/channels"
        backLabel="Back to Channels"
        title="Drive"
        description="Your file-storage accounts, connected through managed-browser sessions. No credentials stored."
      />
      {providers.length === 0 ? (
        <div className="card p-6 border border-white/10 rounded-lg bg-white/5 text-sm text-white/60">
          No drive providers are registered yet.
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

"use client";

// G-T06.D14 placeholder (D15 retrofit): Phone / Voice subpage placeholder
// for route typing and back-nav consistency. The real implementation
// arrives in G-T06.D17 as a roadmap subpage listing candidate providers
// (Google Voice, Twilio managed-console, Phone.com, RingCentral,
// OpenPhone). The D15 operator UX fix (top back-nav arrow) is applied
// here so every Channels subpage has consistent navigation even before
// the category implementation lands.

import React from "react";
import { SubpageHeader } from "../shared";

export default function PhoneSubpagePlaceholder() {
  return (
    <div className="space-y-6" data-testid="channels-phone-subpage-placeholder">
      <SubpageHeader
        backHref="/settings/channels"
        backLabel="Back to Channels"
        title="Phone & Voice"
        description="Phone and voice provider management is planned for a future AKIOR release."
      />
      <div className="card p-6 border border-dashed border-white/15 rounded-lg bg-white/2 text-sm text-white/60 space-y-3">
        <p>
          This subpage is a placeholder. In <b>G-T06.D17</b> it will list planned providers
          (Google Voice first, then Twilio via managed console, Phone.com, RingCentral,
          OpenPhone) as a roadmap preview. Actual Phone/Voice implementation arrives in
          later slices (D19+).
        </p>
      </div>
    </div>
  );
}

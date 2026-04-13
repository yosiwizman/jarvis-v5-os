"use client";

// G-T06.D14 placeholder (D15 retrofit): Messages subpage placeholder for
// route typing and back-nav consistency. The real implementation arrives
// in G-T06.D16 and will render the WhatsApp card and the iMessage
// "requires macOS bridge" placeholder from ../shared.tsx. This file is
// intentionally small until then. The D15 operator UX fix (top back-nav
// arrow) is applied here so every Channels subpage has consistent
// navigation even before the category implementation lands.

import React from "react";
import { SubpageHeader } from "../shared";

export default function MessagesSubpagePlaceholder() {
  return (
    <div className="space-y-6" data-testid="channels-messages-subpage-placeholder">
      <SubpageHeader
        backHref="/settings/channels"
        backLabel="Back to Channels"
        title="Messages"
        description="Messaging provider management is moving here in the next release."
      />
      <div className="card p-6 border border-dashed border-white/15 rounded-lg bg-white/2 text-sm text-white/60 space-y-3">
        <p>
          This subpage is a placeholder. In <b>G-T06.D16</b> it will render the WhatsApp
          card (QR-scan linking) and the iMessage "requires macOS bridge" placeholder.
        </p>
      </div>
    </div>
  );
}

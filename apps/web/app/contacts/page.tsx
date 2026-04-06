"use client";

import React, { useState } from "react";

type Contact = {
  id: string;
  name: string;
  relationship: string;
  allowLevel: string;
  takeoverMode: boolean;
};

const EXAMPLE_CONTACTS: Contact[] = [
  {
    id: "1",
    name: "Sarah Wizman",
    relationship: "Wife",
    allowLevel: "Full Access",
    takeoverMode: true,
  },
  {
    id: "2",
    name: "David Cohen",
    relationship: "Employee",
    allowLevel: "Work Only",
    takeoverMode: false,
  },
  {
    id: "3",
    name: "Mike Torres",
    relationship: "Friend",
    allowLevel: "Limited",
    takeoverMode: false,
  },
];

function RelationshipBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    Wife: "bg-pink-500/20 text-pink-300 border-pink-500/40",
    Employee: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    Friend: "bg-green-500/20 text-green-300 border-green-500/40",
  };
  const style = styles[label] || "bg-white/10 text-white/50 border-white/20";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${style}`}>
      {label}
    </span>
  );
}

function ToggleSwitch({ enabled }: { enabled: boolean }) {
  return (
    <div
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-green-500" : "bg-white/20"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </div>
  );
}

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-6" data-testid="contacts-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <button
          type="button"
          className="btn px-4 py-2 bg-[color:rgb(var(--akior-accent)_/_0.15)] border border-[color:rgb(var(--akior-accent)_/_0.4)] hover:bg-[color:rgb(var(--akior-accent)_/_0.25)] transition-colors rounded"
        >
          + Add Contact
        </button>
      </div>

      {/* Search Bar */}
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search contacts..."
          className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[color:rgb(var(--akior-accent)_/_0.6)]"
        />
      </div>

      {/* Contact Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {EXAMPLE_CONTACTS.map((contact) => (
          <div
            key={contact.id}
            className="card p-4 space-y-3 border border-white/10 rounded-lg bg-white/5 hover:border-white/30 transition-all"
          >
            {/* Name and Relationship */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">{contact.name}</h3>
              <RelationshipBadge label={contact.relationship} />
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="text-white/40">Allow Level:</div>
              <div className="text-white/70">{contact.allowLevel}</div>
            </div>

            {/* Takeover Mode Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-sm text-white/60">Takeover Mode</span>
              <ToggleSwitch enabled={contact.takeoverMode} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

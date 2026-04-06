"use client";

import React, { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

type Contact = {
  id: string;
  name: string;
  relationship: string;
  allowLevel: string;
  blockList: string[];
  replyPersona: string;
  standingInstructions: string;
  takeoverMode: boolean;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

const RELATIONSHIPS = ["wife", "daughter", "employee", "partner", "friend", "colleague", "family"];
const PRIORITIES = ["urgent", "normal", "low"];

function RelationshipBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    wife: "bg-pink-500/20 text-pink-300 border-pink-500/40",
    daughter: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    employee: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    partner: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    friend: "bg-green-500/20 text-green-300 border-green-500/40",
    colleague: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    family: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  };
  const style = styles[label] || "bg-white/10 text-white/50 border-white/20";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${style}`}>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    urgent: "bg-red-500/20 text-red-300 border-red-500/40",
    normal: "bg-white/10 text-white/50 border-white/20",
    low: "bg-white/5 text-white/30 border-white/10",
  };
  const style = styles[priority] || styles.normal;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${style}`}>
      {priority}
    </span>
  );
}

function ToggleSwitch({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-green-500" : "bg-white/20"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    relationship: "friend",
    allowLevel: "normal",
    takeoverMode: false,
    priority: "normal",
  });

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/contacts`);
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (err) {
      console.error("Failed to fetch contacts", err);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    try {
      await fetch(`${API}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setFormData({ name: "", relationship: "friend", allowLevel: "normal", takeoverMode: false, priority: "normal" });
      setShowForm(false);
      fetchContacts();
    } catch (err) {
      console.error("Failed to create contact", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API}/api/contacts/${id}`, { method: "DELETE" });
      fetchContacts();
    } catch (err) {
      console.error("Failed to delete contact", err);
    }
  };

  const handleToggleTakeover = async (contact: Contact) => {
    try {
      await fetch(`${API}/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takeoverMode: !contact.takeoverMode }),
      });
      fetchContacts();
    } catch (err) {
      console.error("Failed to toggle takeover", err);
    }
  };

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.relationship.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="contacts-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn px-4 py-2 bg-[color:rgb(var(--akior-accent)_/_0.15)] border border-[color:rgb(var(--akior-accent)_/_0.4)] hover:bg-[color:rgb(var(--akior-accent)_/_0.25)] transition-colors rounded"
        >
          {showForm ? "Cancel" : "+ Add Contact"}
        </button>
      </div>

      {/* Add Contact Form */}
      {showForm && (
        <div className="p-4 border border-white/10 rounded-lg bg-white/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contact name"
                className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[color:rgb(var(--akior-accent)_/_0.6)]"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Relationship</label>
              <select
                value={formData.relationship}
                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[color:rgb(var(--akior-accent)_/_0.6)]"
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Allow Level</label>
              <input
                type="text"
                value={formData.allowLevel}
                onChange={(e) => setFormData({ ...formData, allowLevel: e.target.value })}
                placeholder="e.g. high, normal, work-only"
                className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[color:rgb(var(--akior-accent)_/_0.6)]"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[color:rgb(var(--akior-accent)_/_0.6)]"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-white/60">Takeover Mode</label>
            <ToggleSwitch
              enabled={formData.takeoverMode}
              onClick={() => setFormData({ ...formData, takeoverMode: !formData.takeoverMode })}
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
          >
            Save Contact
          </button>
        </div>
      )}

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
        {filtered.map((contact) => (
          <div
            key={contact.id}
            className="card p-4 space-y-3 border border-white/10 rounded-lg bg-white/5 hover:border-white/30 transition-all"
          >
            {/* Name and Relationship */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">{contact.name}</h3>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={contact.priority} />
                <RelationshipBadge label={contact.relationship} />
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="text-white/40">Allow Level:</div>
              <div className="text-white/70">{contact.allowLevel}</div>
            </div>

            {/* Takeover Mode Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-sm text-white/60">Takeover Mode</span>
              <ToggleSwitch
                enabled={contact.takeoverMode}
                onClick={() => handleToggleTakeover(contact)}
              />
            </div>

            {/* Delete */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleDelete(contact.id)}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-white/30 py-8">
            {contacts.length === 0 ? "No contacts yet. Add one above." : "No contacts match your search."}
          </div>
        )}
      </div>
    </div>
  );
}

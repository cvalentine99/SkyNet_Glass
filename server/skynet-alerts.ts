/**
 * Skynet Alert Checker
 *
 * Runs after each stats fetch to detect anomalies and send notifications.
 * Alert types:
 *   - block_spike: Total blocks increased by more than threshold in one cycle
 *   - new_country: A new country appeared in the threat data
 *   - new_port: A new port was targeted (not seen before)
 *
 * Uses the notifyOwner() helper from the template's notification system.
 * Respects cooldown periods to prevent notification spam.
 */

import { notifyOwner } from "./_core/notification";
import {
  getAlertConfig,
  saveAlertRecord,
  getLastAlertOfType,
} from "./skynet-db";
import type { SkynetStats } from "./skynet-parser";

// ─── In-memory state for comparison ─────────────────────────

let previousTotalBlocks: number | null = null;
let previousCountryCodes: Set<string> = new Set();
let previousPorts: Set<number> = new Set();

/**
 * Initialize the alert checker with current data.
 * Called once at startup to set the baseline.
 */
export function initAlertBaseline(stats: SkynetStats): void {
  previousTotalBlocks = (stats.kpi.inboundBlocks || 0) + (stats.kpi.outboundBlocks || 0);

  previousCountryCodes = new Set<string>();
  const allConnections = [
    ...(stats.topInboundBlocks || []),
    ...(stats.topOutboundBlocks || []),
    ...(stats.topHttpBlocks || []),
  ];
  for (const c of allConnections) {
    if (c.country) previousCountryCodes.add(c.country);
  }

  previousPorts = new Set<number>();
  for (const p of stats.inboundPortHits || []) {
    if (p.port) previousPorts.add(p.port);
  }
}

/**
 * Check for alert conditions after a stats fetch.
 * Returns the list of alerts that were triggered.
 */
export async function checkAlerts(stats: SkynetStats): Promise<Array<{
  type: string;
  title: string;
  content: string;
  delivered: boolean;
}>> {
  const config = await getAlertConfig();
  if (!config || !config.alertsEnabled) return [];

  const triggered: Array<{
    type: string;
    title: string;
    content: string;
    delivered: boolean;
  }> = [];

  const currentTotalBlocks = (stats.kpi.inboundBlocks || 0) + (stats.kpi.outboundBlocks || 0);

  // ─── Block Spike Detection ──────────────────────────────
  if (config.blockSpikeEnabled && previousTotalBlocks !== null) {
    const delta = currentTotalBlocks - previousTotalBlocks;
    if (delta >= config.blockSpikeThreshold) {
      const canSend = await checkCooldown("block_spike", config.cooldownMinutes);
      if (canSend) {
        const title = `⚠️ Block Spike Detected: +${delta.toLocaleString()} blocks`;
        const content = [
          `Skynet detected a significant increase in blocked connections.`,
          ``,
          `• Previous total: ${previousTotalBlocks.toLocaleString()}`,
          `• Current total: ${currentTotalBlocks.toLocaleString()}`,
          `• Increase: +${delta.toLocaleString()} blocks`,
          `• Threshold: ${config.blockSpikeThreshold.toLocaleString()}`,
          ``,
          `This may indicate an active attack or scan against your network.`,
          `Check the Skynet Glass dashboard for details.`,
        ].join("\n");

        const delivered = await sendAlert(title, content);
        triggered.push({ type: "block_spike", title, content, delivered });
      }
    }
  }

  // ─── New Country Detection ──────────────────────────────
  if (config.newCountryEnabled && previousCountryCodes.size > 0) {
    const currentCountries = new Set<string>();
    const allConnections = [
      ...(stats.topInboundBlocks || []),
      ...(stats.topOutboundBlocks || []),
      ...(stats.topHttpBlocks || []),
    ];
    for (const c of allConnections) {
      if (c.country) currentCountries.add(c.country);
    }

    const newCountries: string[] = [];
    for (const code of Array.from(currentCountries)) {
      if (!previousCountryCodes.has(code)) {
        // Check if the country has enough blocks to be noteworthy
        const totalBlocks = allConnections
          .filter(c => c.country === code)
          .reduce((sum, c) => sum + c.hits, 0);
        if (totalBlocks >= config.countryMinBlocks) {
          newCountries.push(`${code} (${totalBlocks.toLocaleString()} blocks)`);
        }
      }
    }

    if (newCountries.length > 0) {
      const canSend = await checkCooldown("new_country", config.cooldownMinutes);
      if (canSend) {
        const title = `🌍 New Threat Source${newCountries.length > 1 ? "s" : ""}: ${newCountries.length} new countr${newCountries.length > 1 ? "ies" : "y"}`;
        const content = [
          `Skynet detected traffic from ${newCountries.length > 1 ? "countries" : "a country"} not previously seen:`,
          ``,
          ...newCountries.map(c => `• ${c}`),
          ``,
          `Minimum threshold: ${config.countryMinBlocks} blocks`,
          `Check the Threat Map for geographic visualization.`,
        ].join("\n");

        const delivered = await sendAlert(title, content);
        triggered.push({ type: "new_country", title, content, delivered });
      }
    }
  }

  // ─── New Port Detection ─────────────────────────────────
  if (config.newPortEnabled && previousPorts.size > 0) {
    const currentPorts = new Set<number>();
    for (const p of stats.inboundPortHits || []) {
      if (p.port) currentPorts.add(p.port);
    }

    const newPorts: Array<{ port: number; hits: number }> = [];
    for (const p of stats.inboundPortHits || []) {
      if (p.port && !previousPorts.has(p.port) && p.hits >= 10) {
        newPorts.push({ port: p.port, hits: p.hits });
      }
    }

    if (newPorts.length > 0) {
      const canSend = await checkCooldown("new_port", config.cooldownMinutes);
      if (canSend) {
        const title = `🔍 New Port${newPorts.length > 1 ? "s" : ""} Targeted: ${newPorts.map(p => p.port).join(", ")}`;
        const content = [
          `Skynet detected scanning on ${newPorts.length > 1 ? "ports" : "a port"} not previously targeted:`,
          ``,
          ...newPorts.map(p => `• Port ${p.port}: ${p.hits.toLocaleString()} hits`),
          ``,
          `This may indicate reconnaissance activity against your network.`,
          `Review the Logs page for detailed connection information.`,
        ].join("\n");

        const delivered = await sendAlert(title, content);
        triggered.push({ type: "new_port", title, content, delivered });
      }
    }
  }

  // Update baseline for next comparison
  initAlertBaseline(stats);

  return triggered;
}

// ─── Helpers ────────────────────────────────────────────────

async function checkCooldown(alertType: string, cooldownMinutes: number): Promise<boolean> {
  const lastAlert = await getLastAlertOfType(alertType);
  if (!lastAlert) return true;

  const cooldownMs = cooldownMinutes * 60 * 1000;
  const elapsed = Date.now() - lastAlert.triggeredAt.getTime();
  return elapsed >= cooldownMs;
}

async function sendAlert(title: string, content: string): Promise<boolean> {
  let delivered = false;
  try {
    delivered = await notifyOwner({ title, content });
  } catch (err) {
    console.warn("[Skynet Alerts] Failed to send notification:", err);
  }

  await saveAlertRecord({
    alertType: title.includes("Spike") ? "block_spike" : title.includes("Country") || title.includes("countr") ? "new_country" : "new_port",
    title,
    content,
    delivered,
  });

  return delivered;
}

/**
 * Get the current alert baseline state (for testing/debugging).
 */
export function getAlertBaseline() {
  return {
    previousTotalBlocks,
    previousCountryCodes: Array.from(previousCountryCodes),
    previousPorts: Array.from(previousPorts),
  };
}

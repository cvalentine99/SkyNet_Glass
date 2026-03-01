/**
 * Export utilities — download Skynet stats as JSON or CSV
 */

interface ExportData {
  kpiData: Record<string, unknown>;
  inboundPortHits: Array<{ port: number; service?: string; hits: number }>;
  sourcePortHits: Array<{ port: number; hits: number }>;
  countryDistribution: Array<{ country: string; code: string; blocks: number; percentage: number }>;
  topInboundBlocks: Array<{ ip: string; hits: number; country: string }>;
  topOutboundBlocks: Array<{ ip: string; hits: number; country: string }>;
  connectionTypes: Array<{ name: string; value: number }>;
  blockedIPs: Array<Record<string, unknown>>;
  fetchedAt: Date | string | null;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function arrayToCsv(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        const str = val === null || val === undefined ? "" : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export function exportAsJson(data: ExportData) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const content = JSON.stringify(data, null, 2);
  downloadFile(content, `skynet-stats-${timestamp}.json`, "application/json");
}

export function exportAsCsv(data: ExportData) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const sections: string[] = [];

  // KPI Summary
  sections.push("# KPI Summary");
  const kpiRows = Object.entries(data.kpiData).map(([key, value]) => ({
    metric: key,
    value: String(value),
  }));
  sections.push(arrayToCsv(kpiRows));

  // Inbound Port Hits
  if (data.inboundPortHits.length > 0) {
    sections.push("\n# Inbound Port Hits");
    sections.push(arrayToCsv(data.inboundPortHits as unknown as Array<Record<string, unknown>>));
  }

  // Source Port Hits
  if (data.sourcePortHits.length > 0) {
    sections.push("\n# Source Port Hits");
    sections.push(arrayToCsv(data.sourcePortHits as unknown as Array<Record<string, unknown>>));
  }

  // Country Distribution
  if (data.countryDistribution.length > 0) {
    sections.push("\n# Country Distribution");
    sections.push(arrayToCsv(data.countryDistribution as unknown as Array<Record<string, unknown>>));
  }

  // Top Inbound Blocks
  if (data.topInboundBlocks.length > 0) {
    sections.push("\n# Top Inbound Blocks");
    sections.push(arrayToCsv(data.topInboundBlocks as unknown as Array<Record<string, unknown>>));
  }

  // Top Outbound Blocks
  if (data.topOutboundBlocks.length > 0) {
    sections.push("\n# Top Outbound Blocks");
    sections.push(arrayToCsv(data.topOutboundBlocks as unknown as Array<Record<string, unknown>>));
  }

  // Port Hit Distribution
  if (data.connectionTypes.length > 0) {
    sections.push("\n# Port Hit Distribution");
    sections.push(arrayToCsv(data.connectionTypes as unknown as Array<Record<string, unknown>>));
  }

  // Blocked IPs
  if (data.blockedIPs.length > 0) {
    sections.push("\n# Blocked IPs");
    sections.push(arrayToCsv(data.blockedIPs));
  }

  const content = sections.join("\n");
  downloadFile(content, `skynet-stats-${timestamp}.csv`, "text/csv");
}

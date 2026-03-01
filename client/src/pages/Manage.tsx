/**
 * Manage — Firewall Management Page
 * Provides controls for Skynet firewall operations:
 *   - Ban IP / Range / Domain / Country
 *   - Unban IP / Range / Domain / Bulk categories
 *   - Whitelist IP / Domain
 *   - Remove from whitelist
 *   - Refresh shared whitelists
 *
 * All commands map to real Skynet firewall.sh commands.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { GlassCard } from "@/components/GlassCard";
import { Sidebar } from "@/components/Sidebar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ShieldAlert,
  ShieldOff,
  ShieldCheck,
  ShieldPlus,
  ArrowLeft,
  Loader2,
  Globe,
  Network,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Ban,
  ListX,
  Upload,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Reusable Command Form ────────────────────────────────

interface CommandFormProps {
  title: string;
  description: string;
  fields: {
    name: string;
    label: string;
    placeholder: string;
    type?: "text" | "textarea";
    required?: boolean;
  }[];
  buttonLabel: string;
  buttonIcon: typeof ShieldAlert;
  buttonVariant: "critical" | "high" | "gold" | "low";
  onSubmit: (values: Record<string, string>) => void;
  isPending: boolean;
  requireConfirmation?: boolean;
  confirmMessage?: string;
}

function CommandForm({
  title,
  description,
  fields,
  buttonLabel,
  buttonIcon: ButtonIcon,
  buttonVariant,
  onSubmit,
  isPending,
  requireConfirmation,
  confirmMessage,
}: CommandFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const variantStyles = {
    critical: "bg-severity-critical/15 text-severity-critical hover:bg-severity-critical/25 border-severity-critical/30",
    high: "bg-severity-high/15 text-severity-high hover:bg-severity-high/25 border-severity-high/30",
    gold: "bg-gold/15 text-gold hover:bg-gold/25 border-gold/30",
    low: "bg-severity-low/15 text-severity-low hover:bg-severity-low/25 border-severity-low/30",
  };

  const handleSubmit = () => {
    if (requireConfirmation && !confirming) {
      setConfirming(true);
      return;
    }
    onSubmit(values);
    setValues({});
    setConfirming(false);
  };

  const handleCancel = () => {
    setConfirming(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-end gap-3">
        {fields.map((field) => (
          <div key={field.name} className="flex-1">
            <label className="block text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">
              {field.label}
            </label>
            <input
              type="text"
              placeholder={field.placeholder}
              value={values[field.name] || ""}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border
                text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50
                font-mono"
            />
          </div>
        ))}
        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold border transition-all",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                variantStyles[buttonVariant]
              )}
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              Confirm
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-secondary/50 text-muted-foreground
                hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isPending || fields.some((f) => f.required && !values[f.name])}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              variantStyles[buttonVariant]
            )}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ButtonIcon className="w-3.5 h-3.5" />}
            {buttonLabel}
          </button>
        )}
      </div>
      {confirming && confirmMessage && (
        <p className="text-[10px] text-severity-high flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          {confirmMessage}
        </p>
      )}
    </div>
  );
}

// ─── Bulk Unban Card ──────────────────────────────────────

function BulkUnbanCard({
  label,
  description,
  category,
  icon: Icon,
}: {
  label: string;
  description: string;
  category: "malware" | "nomanual" | "country" | "all";
  icon: typeof Ban;
}) {
  const [confirming, setConfirming] = useState(false);
  const utils = trpc.useUtils();

  const mutation = trpc.skynet.unbanBulk.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Bulk unban: ${label}`, {
          description: "Command sent to router successfully",
        });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error(`Failed: ${label}`, {
          description: result.error || "Unknown error",
        });
      }
      setConfirming(false);
    },
    onError: (err) => {
      toast.error("Command failed", { description: err.message });
      setConfirming(false);
    },
  });

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-severity-high/10">
          <Icon className="w-4 h-4 text-severity-high" />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              mutation.mutate({ category });
            }}
            disabled={mutation.isPending}
            className="px-3 py-1 rounded-lg text-[10px] font-bold bg-severity-critical/20 text-severity-critical
              hover:bg-severity-critical/30 transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-3 py-1 rounded-lg text-[10px] font-bold bg-secondary/50 text-muted-foreground
              hover:bg-secondary/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="px-3 py-1 rounded-lg text-[10px] font-bold bg-severity-high/10 text-severity-high/80
            hover:bg-severity-high/20 hover:text-severity-high transition-colors"
        >
          Execute
        </button>
      )}
    </div>
  );
}

/// ─── Bulk Import Parser ──────────────────────────────────

interface ParsedEntry {
  address: string;
  type: "ip" | "range";
  valid: boolean;
  error?: string;
}

function parseImportText(text: string): ParsedEntry[] {
  const lines = text.split(/\n/);
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    // Strip comments (# or //) and trim
    const line = rawLine.replace(/#.*$/, "").replace(/\/\/.*$/, "").trim();
    if (!line) continue;

    // Support comma-separated or space-separated on same line
    const tokens = line.split(/[,;\s]+/).filter(Boolean);

    for (const token of tokens) {
      const addr = token.trim();
      if (!addr) continue;

      // Deduplicate
      if (seen.has(addr)) continue;
      seen.add(addr);

      // Detect type
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(addr)) {
        // CIDR range
        const cidr = parseInt(addr.split("/")[1], 10);
        if (cidr < 8 || cidr > 32) {
          entries.push({ address: addr, type: "range", valid: false, error: "CIDR must be /8 to /32" });
        } else {
          entries.push({ address: addr, type: "range", valid: true });
        }
      } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr)) {
        // Single IP
        const octets = addr.split(".").map(Number);
        if (octets.some(o => o > 255)) {
          entries.push({ address: addr, type: "ip", valid: false, error: "Octet > 255" });
        } else if (octets[0] === 0 || octets[0] === 127 || octets[0] === 255) {
          entries.push({ address: addr, type: "ip", valid: false, error: "Reserved address" });
        } else {
          entries.push({ address: addr, type: "ip", valid: true });
        }
      } else {
        entries.push({ address: addr, type: "ip", valid: false, error: "Not a valid IP or CIDR" });
      }
    }
  }

  return entries;
}

// ─── Bulk Import Section ─────────────────────────────────

function BulkImportSection() {
  const [rawText, setRawText] = useState("");
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [comment, setComment] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [importResults, setImportResults] = useState<Array<{ address: string; type: string; success: boolean; error: string | null }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useState<HTMLInputElement | null>(null);
  const utils = trpc.useUtils();

  const bulkImportMutation = trpc.skynet.bulkBanImport.useMutation({
    onSuccess: (result) => {
      setImportResults(result.results);
      setShowResults(true);
      if (result.succeeded > 0) {
        toast.success(`Bulk import complete`, {
          description: `${result.succeeded} banned, ${result.failed} failed, ${result.skipped} skipped`,
        });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error("Bulk import failed", {
          description: `${result.failed} failed, ${result.skipped} skipped`,
        });
      }
    },
    onError: (err) => {
      toast.error("Bulk import failed", { description: err.message });
    },
  });

  const handleTextChange = (text: string) => {
    setRawText(text);
    const entries = parseImportText(text);
    setParsedEntries(entries);
    setShowResults(false);
  };

  const handleFileRead = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleTextChange(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
  };

  const handleImport = () => {
    const validEntries = parsedEntries.filter(e => e.valid);
    if (validEntries.length === 0) return;

    bulkImportMutation.mutate({
      entries: validEntries.map(e => ({
        address: e.address,
        type: e.type,
        comment: comment || undefined,
      })),
    });
  };

  const handleClear = () => {
    setRawText("");
    setParsedEntries([]);
    setFileName(null);
    setShowResults(false);
    setImportResults([]);
    setComment("");
  };

  const validCount = parsedEntries.filter(e => e.valid).length;
  const invalidCount = parsedEntries.filter(e => !e.valid).length;
  const ipCount = parsedEntries.filter(e => e.valid && e.type === "ip").length;
  const rangeCount = parsedEntries.filter(e => e.valid && e.type === "range").length;

  return (
    <GlassCard className="mb-6 p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-severity-critical/10">
          <Upload className="w-4 h-4 text-severity-critical" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Bulk Ban Import</h2>
          <p className="text-[10px] text-muted-foreground">Import IPs and CIDR ranges from a text file or paste directly (max 500 entries)</p>
        </div>
      </div>

      {/* Drop Zone / File Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all duration-200 mb-4",
          isDragging
            ? "border-gold/60 bg-gold/5"
            : "border-border/40 hover:border-border/60"
        )}
      >
        {!rawText ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors",
              isDragging ? "bg-gold/15" : "bg-secondary/30"
            )}>
              <Upload className={cn("w-5 h-5", isDragging ? "text-gold" : "text-muted-foreground")} />
            </div>
            <p className="text-xs text-foreground font-medium mb-1">
              {isDragging ? "Drop file here" : "Drag & drop a text file"}
            </p>
            <p className="text-[10px] text-muted-foreground mb-3">
              or click to browse • .txt, .csv, .list files • one IP/range per line
            </p>
            <label className="cursor-pointer px-4 py-1.5 rounded-lg text-xs font-medium glass-card hover:border-gold/30 text-foreground transition-all">
              <input
                type="file"
                accept=".txt,.csv,.list,.conf,.log"
                onChange={handleFileSelect}
                className="hidden"
              />
              Browse Files
            </label>
          </div>
        ) : (
          <div className="p-3">
            {/* File info bar */}
            {fileName && (
              <div className="flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg bg-secondary/20">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-gold" />
                  <span className="text-xs text-foreground font-mono">{fileName}</span>
                </div>
                <button
                  onClick={handleClear}
                  className="p-1 rounded hover:bg-secondary/40 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
            {/* Text area */}
            <textarea
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Paste IPs and CIDR ranges here, one per line...\n\n# Comments are supported\n192.168.1.1\n10.0.0.0/24\n8.8.8.8"
              className="w-full h-32 px-3 py-2 text-xs font-mono rounded-lg bg-secondary/30 border border-border/30
                text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/50
                resize-none"
            />
          </div>
        )}
      </div>

      {/* Or paste manually */}
      {!rawText && (
        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground text-center mb-2">or paste directly</p>
          <textarea
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="192.168.1.1&#10;10.0.0.0/24&#10;# Comments are ignored&#10;8.8.8.8, 1.2.3.4"
            className="w-full h-24 px-3 py-2 text-xs font-mono rounded-lg bg-secondary/30 border border-border/30
              text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/50
              resize-none"
          />
        </div>
      )}

      {/* Parsed Summary */}
      {parsedEntries.length > 0 && (
        <div className="space-y-3">
          {/* Stats bar */}
          <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-secondary/20">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-severity-low" />
              <span className="text-[10px] text-muted-foreground">
                <span className="text-foreground font-medium">{validCount}</span> valid
              </span>
            </div>
            {invalidCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-severity-critical" />
                <span className="text-[10px] text-muted-foreground">
                  <span className="text-severity-critical font-medium">{invalidCount}</span> invalid
                </span>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">
              {ipCount} IPs • {rangeCount} ranges
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 text-[10px] text-gold hover:text-gold/80 transition-colors"
            >
              {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showPreview ? "Hide" : "Preview"}
            </button>
          </div>

          {/* Preview table */}
          {showPreview && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border/20">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-1.5 text-left">#</th>
                    <th className="px-3 py-1.5 text-left">Address</th>
                    <th className="px-3 py-1.5 text-left">Type</th>
                    <th className="px-3 py-1.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedEntries.slice(0, 100).map((entry, i) => (
                    <tr key={i} className={cn(
                      "border-t border-border/10",
                      !entry.valid && "bg-severity-critical/5"
                    )}>
                      <td className="px-3 py-1 text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-3 py-1 font-mono text-foreground">{entry.address}</td>
                      <td className="px-3 py-1">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-medium uppercase",
                          entry.type === "range" ? "bg-blue-500/10 text-blue-400" : "bg-gold/10 text-gold"
                        )}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-3 py-1">
                        {entry.valid ? (
                          <span className="text-severity-low flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Valid
                          </span>
                        ) : (
                          <span className="text-severity-critical flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {entry.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedEntries.length > 100 && (
                <p className="text-[10px] text-muted-foreground text-center py-2">
                  Showing first 100 of {parsedEntries.length} entries
                </p>
              )}
            </div>
          )}

          {/* Comment input */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">
              Comment for all entries (optional)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Imported from threat intel feed 2026-03-01"
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border
                text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50
                font-mono"
            />
          </div>

          {/* Import button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={validCount === 0 || bulkImportMutation.isPending}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold border transition-all",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "bg-severity-critical/15 text-severity-critical hover:bg-severity-critical/25 border-severity-critical/30"
              )}
            >
              {bulkImportMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {bulkImportMutation.isPending
                ? "Importing..."
                : `Import ${validCount} ${validCount === 1 ? "Entry" : "Entries"}`}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-secondary/50 text-muted-foreground
                hover:bg-secondary/80 transition-colors"
            >
              Clear
            </button>
            {bulkImportMutation.isPending && (
              <span className="text-[10px] text-muted-foreground">
                Processing... commands are sent with 500ms delay between each
              </span>
            )}
          </div>

          {/* Import Results */}
          {showResults && importResults.length > 0 && (
            <div className="rounded-lg border border-border/20 overflow-hidden">
              <div className="px-3 py-2 bg-secondary/20 flex items-center gap-3">
                <span className="text-xs font-medium text-foreground">Import Results</span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-severity-low">
                    {importResults.filter(r => r.success).length} succeeded
                  </span>
                  {importResults.filter(r => !r.success).length > 0 && (
                    <span className="text-severity-critical">
                      {importResults.filter(r => !r.success).length} failed
                    </span>
                  )}
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {importResults.filter(r => !r.success).map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5 border-t border-border/10 bg-severity-critical/5">
                    <AlertTriangle className="w-3 h-3 text-severity-critical shrink-0" />
                    <span className="text-xs font-mono text-foreground">{r.address}</span>
                    <span className="text-[10px] text-severity-critical">{r.error}</span>
                  </div>
                ))}
                {importResults.filter(r => r.success).length > 0 && (
                  <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/10">
                    <CheckCircle2 className="w-3 h-3 text-severity-low shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      {importResults.filter(r => r.success).length} entries successfully banned
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Format help */}
      <div className="mt-4 px-3 py-2 rounded-lg bg-secondary/10 border border-border/10">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Supported formats:</strong> One IP or CIDR range per line.
          Comments with <code className="text-gold/80 font-mono">#</code> or <code className="text-gold/80 font-mono">//</code> are ignored.
          Comma or space-separated entries on the same line are supported.
          Duplicates are automatically removed. Max 500 entries per import.
        </p>
      </div>
    </GlassCard>
  );
}

// ─── Main Page ────────────────────────────────────────

export default function ManagePage() {
  const utils = trpc.useUtils();

  // ─── Ban Mutations ────────────────────────────────────

  const banIPMutation = trpc.skynet.banIP.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Banned ${vars.ip}`, { description: "IP added to Skynet blacklist" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error(`Failed to ban`, { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Ban failed", { description: err.message }),
  });

  const banRangeMutation = trpc.skynet.banRange.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Banned range ${vars.range}`, { description: "Range added to Skynet blacklist" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error("Failed to ban range", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Ban failed", { description: err.message }),
  });

  const banDomainMutation = trpc.skynet.banDomain.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Banned domain ${vars.domain}`, { description: "All IPs for this domain have been banned" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error("Failed to ban domain", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Ban failed", { description: err.message }),
  });

  const banCountryMutation = trpc.skynet.banCountry.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Banned countries: ${vars.countryCodes.join(", ").toUpperCase()}`, {
          description: "Country IP ranges added to blacklist",
        });
        utils.skynet.getStats.invalidate();
      } else {
        const failedCodes = result.results?.filter((r: any) => !r.success).map((r: any) => r.code).join(", ") || "Unknown";
        toast.error("Failed to ban countries", { description: `Failed: ${failedCodes}` });
      }
    },
    onError: (err) => toast.error("Ban failed", { description: err.message }),
  });

  // ─── Unban Mutations ──────────────────────────────────

  const unbanIPMutation = trpc.skynet.unbanIP.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Unbanned ${vars.ip}`, { description: "IP removed from Skynet blacklist" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error("Failed to unban", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Unban failed", { description: err.message }),
  });

  const unbanRangeMutation = trpc.skynet.unbanRange.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Unbanned range ${vars.range}`, { description: "Range removed from blacklist" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error("Failed to unban range", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Unban failed", { description: err.message }),
  });

  const unbanDomainMutation = trpc.skynet.unbanDomain.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Unbanned domain ${vars.domain}`, { description: "Domain removed from blacklist" });
        utils.skynet.getStats.invalidate();
      } else {
        toast.error("Failed to unban domain", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Unban failed", { description: err.message }),
  });

  // ─── Whitelist Mutations ──────────────────────────────

  const whitelistIPMutation = trpc.skynet.whitelistIP.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Whitelisted ${vars.ip}`, { description: "IP added to Skynet whitelist" });
      } else {
        toast.error("Failed to whitelist", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Whitelist failed", { description: err.message }),
  });

  const whitelistDomainMutation = trpc.skynet.whitelistDomain.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Whitelisted ${vars.domain}`, { description: "Domain added to Skynet whitelist" });
      } else {
        toast.error("Failed to whitelist domain", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Whitelist failed", { description: err.message }),
  });

  const removeWhitelistIPMutation = trpc.skynet.removeWhitelistIP.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Removed ${vars.ip} from whitelist`);
      } else {
        toast.error("Failed to remove from whitelist", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Remove failed", { description: err.message }),
  });

  const removeWhitelistDomainMutation = trpc.skynet.removeWhitelistDomain.useMutation({
    onSuccess: (result, vars) => {
      if (result.success) {
        toast.success(`Removed ${vars.domain} from whitelist`);
      } else {
        toast.error("Failed to remove from whitelist", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Remove failed", { description: err.message }),
  });

  const refreshWhitelistMutation = trpc.skynet.refreshWhitelist.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Whitelist refreshed", { description: "Shared whitelists have been updated" });
      } else {
        toast.error("Refresh failed", { description: result.error || "Unknown error" });
      }
    },
    onError: (err) => toast.error("Refresh failed", { description: err.message }),
  });

  return (
    <div className="min-h-screen bg-background grid-pattern relative">
      <div className="fixed inset-0 bg-gradient-to-b from-background/30 via-background/80 to-background pointer-events-none z-0" />

      <Sidebar activeSection="manage" />

      <main className="ml-[64px] relative z-10 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <a
              href="/"
              className="flex items-center justify-center w-10 h-10 rounded-lg glass-card hover:border-gold/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </a>
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-gold" />
                Firewall Management
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Execute Skynet firewall commands on your router
              </p>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl glass-card border-severity-high/20">
            <AlertTriangle className="w-5 h-5 text-severity-high shrink-0" />
            <p className="text-xs text-muted-foreground">
              Commands are sent directly to your router and executed immediately. Use caution — banning
              your own IP or critical services can lock you out. Changes take effect in real-time on the
              Skynet firewall.
            </p>
          </div>

                {/* ─── Bulk Import Section ────────────────── */}
          <BulkImportSection />

          {/* ─── Ban Section ───────────────────────── */}
          <GlassCard className="mb-6 p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-severity-critical/10">
                <ShieldAlert className="w-4 h-4 text-severity-critical" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Ban</h2>
                <p className="text-[10px] text-muted-foreground">Add IPs, ranges, domains, or countries to the Skynet blacklist</p>
              </div>
            </div>

            <div className="space-y-5">
              <CommandForm
                title="Ban IP Address"
                description="firewall ban ip X.X.X.X &quot;comment&quot;"
                fields={[
                  { name: "ip", label: "IP Address", placeholder: "e.g. 8.8.8.8", required: true },
                  { name: "comment", label: "Comment (optional)", placeholder: "Reason for ban" },
                ]}
                buttonLabel="Ban IP"
                buttonIcon={ShieldAlert}
                buttonVariant="critical"
                onSubmit={(v) => banIPMutation.mutate({ ip: v.ip, comment: v.comment || undefined })}
                isPending={banIPMutation.isPending}
              />

              <div className="border-t border-border/20" />

              <CommandForm
                title="Ban IP Range"
                description="firewall ban range X.X.X.X/CIDR &quot;comment&quot;"
                fields={[
                  { name: "range", label: "CIDR Range", placeholder: "e.g. 10.0.0.0/24", required: true },
                  { name: "comment", label: "Comment (optional)", placeholder: "Reason for ban" },
                ]}
                buttonLabel="Ban Range"
                buttonIcon={Network}
                buttonVariant="critical"
                onSubmit={(v) => banRangeMutation.mutate({ range: v.range, comment: v.comment || undefined })}
                isPending={banRangeMutation.isPending}
              />

              <div className="border-t border-border/20" />

              <CommandForm
                title="Ban Domain"
                description="firewall ban domain example.com — resolves all IPs and bans them"
                fields={[
                  { name: "domain", label: "Domain", placeholder: "e.g. malicious-site.com", required: true },
                ]}
                buttonLabel="Ban Domain"
                buttonIcon={Globe}
                buttonVariant="critical"
                onSubmit={(v) => banDomainMutation.mutate({ domain: v.domain })}
                isPending={banDomainMutation.isPending}
              />

              <div className="border-t border-border/20" />

              <CommandForm
                title="Ban Country"
                description="firewall ban country CC — use 2-letter ISO country codes, space-separated"
                fields={[
                  { name: "codes", label: "Country Codes", placeholder: "e.g. cn ru ir", required: true },
                ]}
                buttonLabel="Ban Countries"
                buttonIcon={Globe}
                buttonVariant="critical"
                requireConfirmation
                confirmMessage="This will ban all IP ranges for the specified countries. This is a large operation."
                onSubmit={(v) => {
                  const codes = v.codes.split(/[\s,]+/).filter(Boolean);
                  banCountryMutation.mutate({ countryCodes: codes });
                }}
                isPending={banCountryMutation.isPending}
              />
            </div>
          </GlassCard>

          {/* ─── Unban Section ────────────────────────────── */}
          <GlassCard className="mb-6 p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-severity-low/10">
                <ShieldOff className="w-4 h-4 text-severity-low" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Unban</h2>
                <p className="text-[10px] text-muted-foreground">Remove IPs, ranges, or domains from the Skynet blacklist</p>
              </div>
            </div>

            <div className="space-y-5">
              <CommandForm
                title="Unban IP Address"
                description="firewall unban ip X.X.X.X"
                fields={[
                  { name: "ip", label: "IP Address", placeholder: "e.g. 8.8.8.8", required: true },
                ]}
                buttonLabel="Unban IP"
                buttonIcon={ShieldOff}
                buttonVariant="low"
                onSubmit={(v) => unbanIPMutation.mutate({ ip: v.ip })}
                isPending={unbanIPMutation.isPending}
              />

              <div className="border-t border-border/20" />

              <CommandForm
                title="Unban IP Range"
                description="firewall unban range X.X.X.X/CIDR"
                fields={[
                  { name: "range", label: "CIDR Range", placeholder: "e.g. 10.0.0.0/24", required: true },
                ]}
                buttonLabel="Unban Range"
                buttonIcon={Network}
                buttonVariant="low"
                onSubmit={(v) => unbanRangeMutation.mutate({ range: v.range })}
                isPending={unbanRangeMutation.isPending}
              />

              <div className="border-t border-border/20" />

              <CommandForm
                title="Unban Domain"
                description="firewall unban domain example.com"
                fields={[
                  { name: "domain", label: "Domain", placeholder: "e.g. example.com", required: true },
                ]}
                buttonLabel="Unban Domain"
                buttonIcon={Globe}
                buttonVariant="low"
                onSubmit={(v) => unbanDomainMutation.mutate({ domain: v.domain })}
                isPending={unbanDomainMutation.isPending}
              />
            </div>
          </GlassCard>

          {/* ─── Bulk Unban Section ───────────────────────── */}
          <GlassCard className="mb-6 p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-severity-high/10">
                <ListX className="w-4 h-4 text-severity-high" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Bulk Unban</h2>
                <p className="text-[10px] text-muted-foreground">Remove entire categories of bans at once — use with caution</p>
              </div>
            </div>

            <div className="space-y-2">
              <BulkUnbanCard
                label="Unban Malware Lists"
                description="Remove all entries added by banmalware (threat feed lists)"
                category="malware"
                icon={Ban}
              />
              <BulkUnbanCard
                label="Unban Non-Manual"
                description="Remove all auto-generated bans, keep only manual bans"
                category="nomanual"
                icon={ListX}
              />
              <BulkUnbanCard
                label="Unban Countries"
                description="Remove all country-based bans"
                category="country"
                icon={Globe}
              />
              <BulkUnbanCard
                label="Unban ALL"
                description="Remove ALL bans — this will clear the entire blacklist"
                category="all"
                icon={Trash2}
              />
            </div>
          </GlassCard>

          {/* ─── Whitelist Section ────────────────────────── */}
          <GlassCard className="mb-6 p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gold/10">
                  <ShieldCheck className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Whitelist</h2>
                  <p className="text-[10px] text-muted-foreground">Add IPs or domains to the Skynet whitelist to prevent blocking</p>
                </div>
              </div>
              <button
                onClick={() => refreshWhitelistMutation.mutate()}
                disabled={refreshWhitelistMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg glass-card hover:border-gold/30 text-foreground transition-all disabled:opacity-50"
              >
                {refreshWhitelistMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Refresh Shared Whitelists
              </button>
            </div>

            <div className="space-y-5">
              <CommandForm
                title="Whitelist IP"
                description="firewall whitelist ip X.X.X.X &quot;comment&quot;"
                fields={[
                  { name: "ip", label: "IP Address", placeholder: "e.g. 1.1.1.1", required: true },
                  { name: "comment", label: "Comment (optional)", placeholder: "Reason for whitelist" },
                ]}
                buttonLabel="Whitelist IP"
                buttonIcon={ShieldPlus}
                buttonVariant="gold"
                onSubmit={(v) => whitelistIPMutation.mutate({ ip: v.ip, comment: v.comment || undefined })}
                isPending={whitelistIPMutation.isPending}
              />

              <div className="border-t border-border/20" />

              <CommandForm
                title="Whitelist Domain"
                description="firewall whitelist domain example.com &quot;comment&quot;"
                fields={[
                  { name: "domain", label: "Domain", placeholder: "e.g. google.com", required: true },
                  { name: "comment", label: "Comment (optional)", placeholder: "Reason for whitelist" },
                ]}
                buttonLabel="Whitelist Domain"
                buttonIcon={Globe}
                buttonVariant="gold"
                onSubmit={(v) => whitelistDomainMutation.mutate({ domain: v.domain, comment: v.comment || undefined })}
                isPending={whitelistDomainMutation.isPending}
              />
            </div>
          </GlassCard>

          {/* ─── Remove from Whitelist ────────────────────── */}
          <GlassCard className="mb-6 p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-severity-high/10">
                <Trash2 className="w-4 h-4 text-severity-high" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Remove from Whitelist</h2>
                <p className="text-[10px] text-muted-foreground">Remove IPs or domains from the Skynet whitelist</p>
              </div>
            </div>

            <div className="space-y-5">
              <CommandForm
                title="Remove IP from Whitelist"
                description="firewall whitelist remove ip X.X.X.X"
                fields={[
                  { name: "ip", label: "IP Address", placeholder: "e.g. 1.1.1.1", required: true },
                ]}
                buttonLabel="Remove IP"
                buttonIcon={Trash2}
                buttonVariant="high"
                onSubmit={(v) => removeWhitelistIPMutation.mutate({ ip: v.ip })}
                isPending={removeWhitelistIPMutation.isPending}
              />

              <div className="border-t border-border/20" />

              <CommandForm
                title="Remove Domain from Whitelist"
                description="firewall whitelist remove domain example.com"
                fields={[
                  { name: "domain", label: "Domain", placeholder: "e.g. example.com", required: true },
                ]}
                buttonLabel="Remove Domain"
                buttonIcon={Trash2}
                buttonVariant="high"
                onSubmit={(v) => removeWhitelistDomainMutation.mutate({ domain: v.domain })}
                isPending={removeWhitelistDomainMutation.isPending}
              />
            </div>
          </GlassCard>

          {/* Info */}
          <GlassCard className="mb-8 p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-gold" />
              Command Reference
            </h2>
            <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                All commands are executed on your router via <code className="text-gold/80 font-mono">SSH</code>,
                running the <code className="text-gold/80 font-mono">/jffs/scripts/firewall</code> script (Skynet) directly.
                Commands execute immediately and changes persist across reboots.
              </p>
              <p>
                <strong className="text-foreground">Ban</strong> adds entries to the Skynet blacklist (ipset).
                <strong className="text-foreground"> Unban</strong> removes them.
                <strong className="text-foreground"> Whitelist</strong> prevents IPs from being blocked even if they match a blacklist rule.
              </p>
              <p>
                <strong className="text-foreground">Country bans</strong> download IP ranges from ipdeny.com and can add thousands of entries.
                <strong className="text-foreground"> Domain bans</strong> resolve the domain's IPs at execution time.
                <strong className="text-foreground"> Bulk unban</strong> operations remove entire categories of bans at once.
              </p>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}

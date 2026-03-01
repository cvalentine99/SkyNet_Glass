/**
 * Settings — Router Connection Configuration
 * Allows the user to configure the Skynet router address, protocol, port,
 * stats path, and polling interval. Also provides test connection and
 * manual fetch/genstats triggers.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { GlassCard } from "@/components/GlassCard";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Server,
  Clock,
  Link2,
  Shield,
} from "lucide-react";

export default function SettingsPage() {
  const [routerAddress, setRouterAddress] = useState("192.168.1.1");
  const [routerPort, setRouterPort] = useState(80);
  const [routerProtocol, setRouterProtocol] = useState<"http" | "https">("http");
  const [statsPath, setStatsPath] = useState("/ext/skynet/stats.js");
  const [pollingInterval, setPollingInterval] = useState(300);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  // Load existing config
  const configQuery = trpc.skynet.getConfig.useQuery();
  const statusQuery = trpc.skynet.getStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const saveConfigMutation = trpc.skynet.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration saved", {
        description: "Router connection settings updated successfully",
      });
      configQuery.refetch();
    },
    onError: (err) => {
      toast.error("Failed to save", { description: err.message });
    },
  });

  const testConnectionMutation = trpc.skynet.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.success && result.isValidStatsFile) {
        toast.success("Connection successful", {
          description: `Valid Skynet stats.js found (${result.contentLength} bytes)`,
        });
      } else if (result.success && !result.isValidStatsFile) {
        toast.warning("File found but invalid", {
          description: result.error ?? "Not a valid Skynet stats.js file",
        });
      } else {
        toast.error("Connection failed", {
          description: result.error ?? "Unknown error",
        });
      }
    },
    onError: (err) => {
      toast.error("Test failed", { description: err.message });
    },
  });

  const fetchNowMutation = trpc.skynet.fetchNow.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Stats fetched", {
          description: result.changed ? "New data received" : "Data unchanged since last fetch",
        });
      } else {
        toast.error("Fetch failed", { description: result.error ?? "Unknown error" });
      }
    },
  });

  const triggerGenstatsMutation = trpc.skynet.triggerGenstats.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Regeneration triggered", {
          description: "Router is regenerating stats. This takes ~45 seconds. Fetch again after.",
        });
      } else {
        toast.error("Trigger failed", { description: result.error ?? "Unknown error" });
      }
    },
  });

  // Populate form from existing config
  useEffect(() => {
    if (configQuery.data) {
      setRouterAddress(configQuery.data.routerAddress);
      setRouterPort(configQuery.data.routerPort);
      setRouterProtocol(configQuery.data.routerProtocol as "http" | "https");
      setStatsPath(configQuery.data.statsPath);
      setPollingInterval(configQuery.data.pollingInterval);
      setPollingEnabled(configQuery.data.pollingEnabled);
    }
  }, [configQuery.data]);

  const handleSave = () => {
    saveConfigMutation.mutate({
      routerAddress,
      routerPort,
      routerProtocol,
      statsPath,
      pollingInterval,
      pollingEnabled,
    });
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate({
      routerAddress,
      routerPort,
      routerProtocol,
      statsPath,
    });
  };

  const status = statusQuery.data;

  return (
    <div className="min-h-screen bg-background grid-pattern relative">
      <div className="fixed inset-0 bg-gradient-to-b from-background/30 via-background/80 to-background pointer-events-none z-0" />

      <main className="relative z-10 min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-8">
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
                <SettingsIcon className="w-6 h-6 text-gold" />
                Router Configuration
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Connect to your Skynet-enabled ASUS router
              </p>
            </div>
          </div>

          {/* Connection Status */}
          <GlassCard className="mb-6 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {status?.isPolling ? (
                  <div className="flex items-center gap-2 text-severity-low">
                    <Wifi className="w-5 h-5" />
                    <span className="text-sm font-medium">Polling Active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <WifiOff className="w-5 h-5" />
                    <span className="text-sm font-medium">Polling Inactive</span>
                  </div>
                )}
                {status?.lastFetchTime && (
                  <span className="text-xs text-muted-foreground ml-4">
                    Last fetch: {new Date(status.lastFetchTime).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchNowMutation.mutate()}
                  disabled={fetchNowMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md glass-card hover:border-gold/30 text-foreground transition-all disabled:opacity-50"
                >
                  {fetchNowMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Fetch Now
                </button>
                <button
                  onClick={() => triggerGenstatsMutation.mutate()}
                  disabled={triggerGenstatsMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md glass-card hover:border-gold/30 text-gold transition-all disabled:opacity-50"
                >
                  {triggerGenstatsMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  Regenerate Stats
                </button>
              </div>
            </div>
            {status?.lastFetchError && (
              <div className="mt-3 flex items-center gap-2 text-xs text-severity-critical bg-severity-critical/10 rounded-md px-3 py-2">
                <XCircle className="w-4 h-4 shrink-0" />
                {status.lastFetchError}
              </div>
            )}
          </GlassCard>

          {/* Connection Form */}
          <GlassCard className="mb-6 p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-5">
              <Server className="w-4 h-4 text-gold" />
              Connection Settings
            </h2>

            <div className="space-y-4">
              {/* Protocol + Address + Port */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3">
                  <label className="block text-xs text-muted-foreground mb-1.5">Protocol</label>
                  <select
                    value={routerProtocol}
                    onChange={(e) => setRouterProtocol(e.target.value as "http" | "https")}
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
                <div className="col-span-6">
                  <label className="block text-xs text-muted-foreground mb-1.5">Router Address</label>
                  <input
                    type="text"
                    value={routerAddress}
                    onChange={(e) => setRouterAddress(e.target.value)}
                    placeholder="192.168.1.1"
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-muted-foreground mb-1.5">Port</label>
                  <input
                    type="number"
                    value={routerPort}
                    onChange={(e) => setRouterPort(parseInt(e.target.value) || 80)}
                    min={1}
                    max={65535}
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
                </div>
              </div>

              {/* Stats Path */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Link2 className="w-3 h-3" />
                  Stats File Path
                </label>
                <input
                  type="text"
                  value={statsPath}
                  onChange={(e) => setStatsPath(e.target.value)}
                  placeholder="/ext/skynet/stats.js"
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Default: /ext/skynet/stats.js — only change if you've customized Skynet's WebUI path
                </p>
              </div>

              {/* Test Connection */}
              <button
                onClick={handleTestConnection}
                disabled={testConnectionMutation.isPending || !routerAddress}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md glass-card-bright hover:border-gold/30 text-foreground transition-all disabled:opacity-50 w-full justify-center"
              >
                {testConnectionMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : testConnectionMutation.data?.success && testConnectionMutation.data?.isValidStatsFile ? (
                  <CheckCircle2 className="w-4 h-4 text-severity-low" />
                ) : testConnectionMutation.data && !testConnectionMutation.data.success ? (
                  <XCircle className="w-4 h-4 text-severity-critical" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                Test Connection
              </button>
            </div>
          </GlassCard>

          {/* Polling Settings */}
          <GlassCard className="mb-6 p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-gold" />
              Polling Settings
            </h2>

            <div className="space-y-4">
              {/* Polling Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-foreground font-medium">Auto-Polling</label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Automatically fetch stats from the router at regular intervals
                  </p>
                </div>
                <button
                  onClick={() => setPollingEnabled(!pollingEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    pollingEnabled ? "bg-gold" : "bg-secondary"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                      pollingEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Interval */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Polling Interval (seconds)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={30}
                    max={3600}
                    step={30}
                    value={pollingInterval}
                    onChange={(e) => setPollingInterval(parseInt(e.target.value))}
                    disabled={!pollingEnabled}
                    className="flex-1 accent-gold disabled:opacity-50"
                  />
                  <span className="text-sm font-mono text-foreground w-20 text-right tabular-nums">
                    {pollingInterval >= 60
                      ? `${Math.floor(pollingInterval / 60)}m ${pollingInterval % 60 ? `${pollingInterval % 60}s` : ""}`
                      : `${pollingInterval}s`}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Recommended: 5-10 minutes. The stats.js file is small (~20KB), so frequent polling is fine.
                  The router only regenerates stats every 12h or on manual trigger.
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={saveConfigMutation.isPending || !routerAddress}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-md bg-gold text-background hover:bg-gold/90 transition-all disabled:opacity-50"
            >
              {saveConfigMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              Save Configuration
            </button>
          </div>

          {/* Info */}
          <GlassCard className="mt-8 p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-gold" />
              How It Works
            </h2>
            <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                This dashboard connects to your ASUS router running the Skynet firewall add-on.
                Skynet generates a <code className="text-gold/80 font-mono">stats.js</code> file
                containing all firewall statistics, which this app fetches and parses into the dashboard.
              </p>
              <p>
                <strong className="text-foreground">Polling</strong> fetches the existing stats.js file — this is lightweight and fast.
                <strong className="text-foreground"> Regenerate Stats</strong> tells the router to re-analyze its logs and rebuild stats.js — this takes ~45 seconds and is CPU-intensive on the router.
              </p>
              <p>
                The router auto-regenerates stats every 12 hours via cron. Use "Regenerate Stats" sparingly
                (every 2-4 hours at most) to get fresh data between cron runs.
              </p>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}

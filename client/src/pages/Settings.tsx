/**
 * Settings — Router Connection Configuration
 * Allows the user to configure the Skynet router address, protocol, port,
 * stats path, polling interval, and HTTP Basic Auth credentials.
 * Also provides test connection and manual fetch/genstats triggers.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { GlassCard } from "@/components/GlassCard";
import { Sidebar } from "@/components/Sidebar";
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
  User,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Bell,
  BellOff,
  AlertTriangle,
  Globe,
  Target,
  History,
  Download,
  Upload,
  FileJson,
  FileCheck,
  FileWarning,
} from "lucide-react";

export default function SettingsPage() {
  const [routerAddress, setRouterAddress] = useState("192.168.50.1");
  const [routerPort, setRouterPort] = useState(8443);
  const [routerProtocol, setRouterProtocol] = useState<"http" | "https">("https");
  const [statsPath, setStatsPath] = useState("/user/skynet/stats.js");
  const [pollingInterval, setPollingInterval] = useState(300);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordPlaceholder, setPasswordPlaceholder] = useState("");

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
      setUsername(configQuery.data.username ?? "");
      // Don't populate password — show placeholder if one exists
      if (configQuery.data.hasPassword) {
        setPasswordPlaceholder("••••••••");
      }
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
      username: username || undefined,
      // Only send password if user typed a new one
      password: password || undefined,
    });
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate({
      routerAddress,
      routerPort,
      routerProtocol,
      statsPath,
      username: username || undefined,
      password: password || undefined,
    });
  };

  const status = statusQuery.data;

  return (
    <div className="min-h-screen bg-background grid-pattern relative">
      <div className="fixed inset-0 bg-gradient-to-b from-background/30 via-background/80 to-background pointer-events-none z-0" />

      <Sidebar activeSection="settings" />

      <main className="ml-[64px] relative z-10 min-h-screen">
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
                  placeholder="/user/skynet/stats.js"
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Default: /user/skynet/stats.js — only change if you've customized Skynet's WebUI path
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

          {/* Authentication */}
          <GlassCard className="mb-6 p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-gold" />
              Authentication
            </h2>
            <p className="text-[10px] text-muted-foreground mb-5">
              ASUS routers use HTTP Basic Auth. Enter your router's admin credentials to enable authenticated data fetching.
            </p>

            <div className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <User className="w-3 h-3" />
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={passwordPlaceholder || "Enter router password"}
                    autoComplete="current-password"
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passwordPlaceholder && !password && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    A password is already saved. Leave blank to keep the existing password, or enter a new one to update it.
                  </p>
                )}
              </div>

              {/* Auth status indicator */}
              {(username || passwordPlaceholder) && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-gold/5 border border-gold/10">
                  <Shield className="w-3.5 h-3.5 text-gold" />
                  <span className="text-muted-foreground">
                    {username && (password || passwordPlaceholder)
                      ? <>Credentials configured for <span className="text-gold font-mono">{username}</span>. Auth headers will be sent with all router requests.</>
                      : username
                        ? <>Username set to <span className="text-gold font-mono">{username}</span>. Add a password to enable authentication.</>
                        : <>A password is saved but no username is set.</>
                    }
                  </span>
                </div>
              )}
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

          {/* ─── Target Location ────────────────────────── */}
          <TargetLocationSection />

          {/* ─── Alert Configuration ─────────────────────── */}
          <AlertConfigSection />

          {/* ─── Config Backup & Restore ─────────────────── */}
          <ConfigBackupSection />

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
                <strong className="text-foreground">Authentication:</strong> ASUS routers require HTTP Basic Auth
                for WebUI access. Enter your router's admin username and password above. Credentials are stored
                securely in the database and sent as Base64-encoded Authorization headers with each request.
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

// ─── Target Location Section ─────────────────────────────────

function TargetLocationSection() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const targetQuery = trpc.skynet.getTargetLocation.useQuery();
  const saveMutation = trpc.skynet.saveTargetLocation.useMutation({
    onSuccess: () => {
      toast.success("Target location saved", {
        description: "Threat map arcs will now point to your router's location",
      });
      targetQuery.refetch();
    },
    onError: (err) => {
      toast.error("Failed to save location", { description: err.message });
    },
  });

  useEffect(() => {
    if (targetQuery.data) {
      if (targetQuery.data.lat !== null) setLat(String(targetQuery.data.lat));
      if (targetQuery.data.lng !== null) setLng(String(targetQuery.data.lng));
    }
  }, [targetQuery.data]);

  const handleSave = () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      toast.error("Invalid coordinates", { description: "Latitude must be -90 to 90, longitude -180 to 180" });
      return;
    }
    saveMutation.mutate({ lat: latNum, lng: lngNum });
  };

  return (
    <GlassCard className="mb-6 p-5">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <MapPin className="w-4 h-4 text-gold" />
        Router Location
      </h2>
      <p className="text-[10px] text-muted-foreground mb-4">
        Set your router's geographic coordinates so the Threat Map shows attack arcs
        pointing to your actual location instead of the default US center.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Latitude</label>
          <input
            type="number"
            step="0.01"
            min={-90}
            max={90}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="37.09 (e.g., your city latitude)"
            className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Longitude</label>
          <input
            type="number"
            step="0.01"
            min={-180}
            max={180}
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="-95.71 (e.g., your city longitude)"
            className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Tip: Search "my coordinates" on Google to find your lat/lng.
          {targetQuery.data?.lat !== null && (
            <span className="ml-2 text-gold/60">
              Current: {targetQuery.data?.lat}, {targetQuery.data?.lng}
            </span>
          )}
        </p>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !lat || !lng}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-gold text-background hover:bg-gold/90 transition-all disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Target className="w-3.5 h-3.5" />
          )}
          Save Location
        </button>
      </div>
    </GlassCard>
  );
}

// ─── Alert Configuration Section ─────────────────────────────

function AlertConfigSection() {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [blockSpikeEnabled, setBlockSpikeEnabled] = useState(true);
  const [blockSpikeThreshold, setBlockSpikeThreshold] = useState(1000);
  const [newCountryEnabled, setNewCountryEnabled] = useState(true);
  const [newPortEnabled, setNewPortEnabled] = useState(false);
  const [countryMinBlocks, setCountryMinBlocks] = useState(50);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [showHistory, setShowHistory] = useState(false);

  const alertConfigQuery = trpc.skynet.getAlertConfig.useQuery();
  const alertHistoryQuery = trpc.skynet.getAlertHistory.useQuery(
    { limit: 20 },
    { enabled: showHistory }
  );

  const saveMutation = trpc.skynet.saveAlertConfig.useMutation({
    onSuccess: () => {
      toast.success("Alert settings saved");
      alertConfigQuery.refetch();
    },
    onError: (err) => {
      toast.error("Failed to save alerts", { description: err.message });
    },
  });

  useEffect(() => {
    if (alertConfigQuery.data) {
      setAlertsEnabled(alertConfigQuery.data.alertsEnabled);
      setBlockSpikeEnabled(alertConfigQuery.data.blockSpikeEnabled);
      setBlockSpikeThreshold(alertConfigQuery.data.blockSpikeThreshold);
      setNewCountryEnabled(alertConfigQuery.data.newCountryEnabled);
      setNewPortEnabled(alertConfigQuery.data.newPortEnabled);
      setCountryMinBlocks(alertConfigQuery.data.countryMinBlocks);
      setCooldownMinutes(alertConfigQuery.data.cooldownMinutes);
    }
  }, [alertConfigQuery.data]);

  const handleSave = () => {
    saveMutation.mutate({
      alertsEnabled,
      blockSpikeEnabled,
      blockSpikeThreshold,
      newCountryEnabled,
      newPortEnabled,
      countryMinBlocks,
      cooldownMinutes,
    });
  };

  return (
    <GlassCard className="mb-6 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4 text-gold" />
          Notification Alerts
        </h2>
        <button
          onClick={() => setAlertsEnabled(!alertsEnabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            alertsEnabled ? "bg-gold" : "bg-secondary"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
              alertsEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground mb-4">
        Get notified when unusual activity is detected on your network.
        Alerts are sent via the Manus notification system after each stats polling cycle.
      </p>

      <div className={`space-y-4 transition-opacity ${alertsEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
        {/* Block Spike */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-severity-critical" />
              <label className="text-xs text-foreground font-medium">Block Spike Detection</label>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-5">
              Alert when total blocks increase by more than the threshold in one polling cycle
            </p>
          </div>
          <button
            onClick={() => setBlockSpikeEnabled(!blockSpikeEnabled)}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ml-3 ${
              blockSpikeEnabled ? "bg-gold" : "bg-secondary"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform ${
                blockSpikeEnabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {blockSpikeEnabled && (
          <div className="ml-5">
            <label className="block text-[10px] text-muted-foreground mb-1">Spike Threshold</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={10000}
                step={10}
                value={blockSpikeThreshold}
                onChange={(e) => setBlockSpikeThreshold(parseInt(e.target.value))}
                className="flex-1 accent-gold"
              />
              <span className="text-xs font-mono text-foreground w-16 text-right tabular-nums">
                {blockSpikeThreshold.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* New Country */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-severity-high" />
              <label className="text-xs text-foreground font-medium">New Country Detection</label>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-5">
              Alert when a new country appears in the threat data
            </p>
          </div>
          <button
            onClick={() => setNewCountryEnabled(!newCountryEnabled)}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ml-3 ${
              newCountryEnabled ? "bg-gold" : "bg-secondary"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform ${
                newCountryEnabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {newCountryEnabled && (
          <div className="ml-5">
            <label className="block text-[10px] text-muted-foreground mb-1">Min Blocks Before Alert</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={1000}
                step={5}
                value={countryMinBlocks}
                onChange={(e) => setCountryMinBlocks(parseInt(e.target.value))}
                className="flex-1 accent-gold"
              />
              <span className="text-xs font-mono text-foreground w-12 text-right tabular-nums">
                {countryMinBlocks}
              </span>
            </div>
          </div>
        )}

        {/* New Port */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-severity-medium" />
              <label className="text-xs text-foreground font-medium">New Port Detection</label>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-5">
              Alert when a previously unseen port is targeted (10+ hits)
            </p>
          </div>
          <button
            onClick={() => setNewPortEnabled(!newPortEnabled)}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ml-3 ${
              newPortEnabled ? "bg-gold" : "bg-secondary"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform ${
                newPortEnabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Cooldown */}
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">Alert Cooldown</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={360}
              step={5}
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(parseInt(e.target.value))}
              className="flex-1 accent-gold"
            />
            <span className="text-xs font-mono text-foreground w-16 text-right tabular-nums">
              {cooldownMinutes >= 60
                ? `${Math.floor(cooldownMinutes / 60)}h ${cooldownMinutes % 60 ? `${cooldownMinutes % 60}m` : ""}`
                : `${cooldownMinutes}m`}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Minimum time between alerts of the same type to prevent spam
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <History className="w-3 h-3" />
          {showHistory ? "Hide" : "Show"} Alert History
        </button>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-gold text-background hover:bg-gold/90 transition-all disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Bell className="w-3.5 h-3.5" />
          )}
          Save Alert Settings
        </button>
      </div>

      {/* Alert History */}
      {showHistory && (
        <div className="mt-4 pt-4 border-t border-border">
          <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-gold" />
            Recent Alerts
          </h3>
          {alertHistoryQuery.isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : !alertHistoryQuery.data?.length ? (
            <p className="text-[10px] text-muted-foreground text-center py-4">
              No alerts have been triggered yet
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alertHistoryQuery.data.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-secondary/30 border border-border"
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    alert.alertType === "block_spike" ? "bg-severity-critical" :
                    alert.alertType === "new_country" ? "bg-severity-high" : "bg-severity-medium"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-foreground font-medium truncate">
                      {alert.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(alert.triggeredAt).toLocaleString()}
                      {alert.delivered ? (
                        <span className="ml-2 text-severity-low">✓ Delivered</span>
                      ) : (
                        <span className="ml-2 text-severity-critical">✗ Failed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

// ─── Config Backup & Restore Section ────────────────────────

function ConfigBackupSection() {
  const [importData, setImportData] = useState<any>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null);

  const exportQuery = trpc.skynet.exportConfig.useQuery(undefined, {
    enabled: false, // manual fetch only
  });

  const importMutation = trpc.skynet.importConfig.useMutation({
    onSuccess: (result) => {
      const parts = [];
      if (result.results.routerConfig) parts.push("router config");
      if (result.results.alertConfig) parts.push("alert settings");
      if (result.results.devicePolicies > 0) parts.push(`${result.results.devicePolicies} device policies`);
      toast.success("Configuration restored", {
        description: parts.length > 0
          ? `Imported: ${parts.join(", ")}`
          : "No new data to import (all entries already exist)",
      });
      setImportData(null);
      setImportFileName("");
      setShowPreview(false);
    },
    onError: (err) => {
      toast.error("Import failed", { description: err.message });
    },
  });

  const handleExport = async () => {
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const json = JSON.stringify(result.data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        a.href = url;
        a.download = `skynet-glass-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Configuration exported", {
          description: "Backup file downloaded successfully",
        });
      }
    } catch (err: any) {
      toast.error("Export failed", { description: err.message });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        // Validate basic structure
        if (!data.version || data.version !== 1) {
          setImportError("Invalid backup file: missing or unsupported version");
          setImportData(null);
          return;
        }
        if (!data.exportedAt) {
          setImportError("Invalid backup file: missing export timestamp");
          setImportData(null);
          return;
        }
        setImportData(data);
        setShowPreview(true);
      } catch {
        setImportError("Invalid JSON file — could not parse backup");
        setImportData(null);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleImport = () => {
    if (!importData) return;
    importMutation.mutate({
      routerConfig: importData.routerConfig ?? null,
      alertConfig: importData.alertConfig ?? null,
      devicePolicies: importData.devicePolicies ?? [],
    });
  };

  return (
    <GlassCard className="mb-6 p-5">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <FileJson className="w-4 h-4 text-gold" />
        Configuration Backup & Restore
      </h2>
      <p className="text-[10px] text-muted-foreground mb-5">
        Export all your configuration (router settings, alert thresholds, device policies) as a JSON
        backup file, or restore from a previous backup.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Export */}
        <div className="p-4 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-4 h-4 text-gold" />
            <h3 className="text-xs font-semibold text-foreground">Export Backup</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">
            Download a JSON file containing all your current configuration.
          </p>
          <button
            onClick={handleExport}
            disabled={exportQuery.isFetching}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
              bg-gold/10 text-gold border border-gold/20
              hover:bg-gold/20 hover:border-gold/30
              transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {exportQuery.isFetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export Configuration
          </button>
        </div>

        {/* Import */}
        <div className="p-4 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4 text-gold" />
            <h3 className="text-xs font-semibold text-foreground">Restore Backup</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">
            Upload a previously exported JSON backup to restore configuration.
          </p>
          <label className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
            bg-secondary/50 text-foreground border border-border
            hover:bg-secondary/70 hover:border-border/80
            transition-all duration-200 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Select Backup File
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Import Error */}
      {importError && (
        <div className="flex items-center gap-2 text-xs text-severity-critical bg-severity-critical/10 rounded-md px-3 py-2 mb-4">
          <FileWarning className="w-4 h-4 shrink-0" />
          {importError}
        </div>
      )}

      {/* Import Preview */}
      {showPreview && importData && (
        <div className="p-4 rounded-lg bg-secondary/20 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <FileCheck className="w-3.5 h-3.5 text-severity-low" />
              Backup Preview
            </h3>
            <button
              onClick={() => { setShowPreview(false); setImportData(null); setImportFileName(""); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">File</span>
              <span className="text-foreground font-mono">{importFileName}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Exported At</span>
              <span className="text-foreground">{new Date(importData.exportedAt).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Router Config</span>
              <span className={importData.routerConfig ? "text-severity-low" : "text-muted-foreground"}>
                {importData.routerConfig ? `${importData.routerConfig.routerAddress}:${importData.routerConfig.routerPort}` : "Not included"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Alert Settings</span>
              <span className={importData.alertConfig ? "text-severity-low" : "text-muted-foreground"}>
                {importData.alertConfig ? "Included" : "Not included"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Device Policies</span>
              <span className={importData.devicePolicies?.length ? "text-severity-low" : "text-muted-foreground"}>
                {importData.devicePolicies?.length
                  ? `${importData.devicePolicies.length} policies`
                  : "None"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 rounded-md px-3 py-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Importing will overwrite your current router config and alert settings. Existing device policies with the same IP will be skipped.
          </div>

          <button
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
              bg-gold/10 text-gold border border-gold/20
              hover:bg-gold/20 hover:border-gold/30
              transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {importMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Restore Configuration
          </button>
        </div>
      )}
    </GlassCard>
  );
}

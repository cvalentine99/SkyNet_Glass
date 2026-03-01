/**
 * DevicePolicies — Per-Device Blocking Policy Management
 * Manage device-specific firewall rules (IOT block outbound, full ban)
 * with enable/disable toggle, quick-add from other pages, and IOT port config.
 */
import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { GlassCard } from "@/components/GlassCard";
import { toast } from "sonner";
import {
  Shield,
  ShieldOff,
  ShieldAlert,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Wifi,
  WifiOff,
  Monitor,
  RefreshCw,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
} from "lucide-react";

/* ─── Policy type labels & colors ────────────────────────── */
const POLICY_META: Record<
  string,
  { label: string; color: string; icon: typeof Shield; desc: string }
> = {
  block_outbound: {
    label: "Block Outbound",
    color: "text-amber-400",
    icon: WifiOff,
    desc: "Blocks all outbound internet access (IOT mode). Device can still communicate on LAN.",
  },
  block_all: {
    label: "Full Block",
    color: "text-red-400",
    icon: ShieldAlert,
    desc: "Bans the device IP in Skynet blacklist. All inbound and outbound traffic is blocked.",
  },
};

export default function DevicePolicies() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showIotConfig, setShowIotConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Form state ─────────────────────────────────────────
  const [newIp, setNewIp] = useState("");
  const [newName, setNewName] = useState("");

  // ─── Pre-fill from URL query params (from other pages) ──
  const searchString = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const ip = params.get("ip");
    const name = params.get("name");
    if (ip) {
      setNewIp(ip);
      if (name) setNewName(name);
      setShowAddForm(true);
    }
  }, []); // Only run once on mount
  const [newMac, setNewMac] = useState("");
  const [newPolicyType, setNewPolicyType] = useState<"block_outbound" | "block_all">("block_outbound");
  const [newReason, setNewReason] = useState("");

  // ─── IOT config state ───────────────────────────────────
  const [iotPorts, setIotPorts] = useState("");
  const [iotProto, setIotProto] = useState<"udp" | "tcp" | "all">("tcp");

  // ─── Data fetching ──────────────────────────────────────
  const policiesQuery = trpc.skynet.getDevicePolicies.useQuery();
  const devicesQuery = trpc.skynet.getDevices.useQuery();
  const utils = trpc.useUtils();

  const createPolicy = trpc.skynet.createDevicePolicy.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Policy created for ${newIp}`);
        setShowAddForm(false);
        resetForm();
        utils.skynet.getDevicePolicies.invalidate();
      } else {
        toast.error(data.error || "Failed to create policy");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const removePolicy = trpc.skynet.removeDevicePolicy.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Policy removed");
        utils.skynet.getDevicePolicies.invalidate();
      } else {
        toast.error(data.error || "Failed to remove policy");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const togglePolicy = trpc.skynet.toggleDevicePolicy.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Policy updated");
        utils.skynet.getDevicePolicies.invalidate();
      } else {
        toast.error(data.error || "Failed to toggle policy");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const setPortsMutation = trpc.skynet.iotSetPorts.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("IOT allowed ports updated");
      } else {
        toast.error(data.error || "Failed to set ports");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const setProtoMutation = trpc.skynet.iotSetProto.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("IOT allowed protocol updated");
      } else {
        toast.error(data.error || "Failed to set protocol");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Derived data ───────────────────────────────────────
  const policies = policiesQuery.data ?? [];
  const devices = devicesQuery.data?.devices ?? [];

  const filteredPolicies = useMemo(() => {
    if (!searchQuery.trim()) return policies;
    const q = searchQuery.toLowerCase();
    return policies.filter(
      (p) =>
        p.deviceIp.includes(q) ||
        (p.deviceName && p.deviceName.toLowerCase().includes(q)) ||
        (p.macAddress && p.macAddress.toLowerCase().includes(q)) ||
        (p.reason && p.reason.toLowerCase().includes(q))
    );
  }, [policies, searchQuery]);

  const stats = useMemo(() => {
    const total = policies.length;
    const enabled = policies.filter((p) => p.enabled).length;
    const outbound = policies.filter((p) => p.policyType === "block_outbound").length;
    const fullBlock = policies.filter((p) => p.policyType === "block_all").length;
    return { total, enabled, disabled: total - enabled, outbound, fullBlock };
  }, [policies]);

  function resetForm() {
    setNewIp("");
    setNewName("");
    setNewMac("");
    setNewPolicyType("block_outbound");
    setNewReason("");
  }

  function handleCreate() {
    if (!newIp.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      toast.error("Please enter a valid IPv4 address");
      return;
    }
    createPolicy.mutate({
      deviceIp: newIp,
      deviceName: newName || undefined,
      macAddress: newMac || undefined,
      policyType: newPolicyType,
      reason: newReason || undefined,
    });
  }

  function selectDevice(ip: string) {
    setNewIp(ip);
    const device = devices.find((d) => d.ip === ip);
    if (device) {
      setNewName(device.hostname || "");
      setNewMac(device.mac || "");
    }
  }

  const isLoading = policiesQuery.isLoading;

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-7 h-7 text-gold" />
            Device Policies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage per-device firewall rules — block outbound (IOT mode) or full isolation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIotConfig(!showIotConfig)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
          >
            <Settings2 className="w-4 h-4" />
            IOT Config
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (showAddForm) resetForm();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gold/20 border border-gold/30 text-gold hover:bg-gold/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Policy
          </button>
          <button
            onClick={() => policiesQuery.refetch()}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${policiesQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── Warning Banner ─────────────────────────────────── */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-200/80">
          Device policies execute real Skynet commands on your router. <strong>Block Outbound</strong> uses
          the IOT ipset to restrict internet access while allowing LAN traffic. <strong>Full Block</strong> adds
          the device IP to the Skynet blacklist, blocking all traffic.
        </p>
      </div>

      {/* ─── IOT Configuration Panel ────────────────────────── */}
      {showIotConfig && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-5 h-5 text-gold" />
            <h2 className="text-lg font-semibold text-foreground">IOT Configuration</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure which ports and protocols IOT-blocked devices are allowed to use.
            These settings apply globally to all devices with "Block Outbound" policies.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Allowed Ports */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Allowed Ports</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={iotPorts}
                  onChange={(e) => setIotPorts(e.target.value)}
                  placeholder="e.g. 123,53,80 or reset"
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
                />
                <button
                  onClick={() => {
                    if (!iotPorts.match(/^(reset|\d{1,5}(,\d{1,5})*)$/)) {
                      toast.error("Enter comma-separated ports or 'reset'");
                      return;
                    }
                    setPortsMutation.mutate({ ports: iotPorts });
                  }}
                  disabled={setPortsMutation.isPending}
                  className="px-3 py-2 rounded-lg bg-gold/20 border border-gold/30 text-gold text-sm font-medium hover:bg-gold/30 transition-all disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Comma-separated port numbers. Use "reset" to clear. Common: 123 (NTP), 53 (DNS), 80 (HTTP), 443 (HTTPS)
              </p>
            </div>
            {/* Allowed Protocol */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Allowed Protocol</label>
              <div className="flex gap-2">
                <select
                  value={iotProto}
                  onChange={(e) => setIotProto(e.target.value as "udp" | "tcp" | "all")}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
                >
                  <option value="tcp">TCP only</option>
                  <option value="udp">UDP only</option>
                  <option value="all">All protocols</option>
                </select>
                <button
                  onClick={() => setProtoMutation.mutate({ proto: iotProto })}
                  disabled={setProtoMutation.isPending}
                  className="px-3 py-2 rounded-lg bg-gold/20 border border-gold/30 text-gold text-sm font-medium hover:bg-gold/30 transition-all disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Protocol for allowed ports. "All" permits both TCP and UDP on the specified ports.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ─── Add Policy Form ────────────────────────────────── */}
      {showAddForm && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-5 h-5 text-gold" />
            <h2 className="text-lg font-semibold text-foreground">Create Device Policy</h2>
          </div>

          {/* Quick-select from known devices */}
          {devices.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Quick Select Device</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-lg bg-white/3 border border-white/5">
                {devices.map((d) => {
                  const hasPolicy = policies.some((p) => p.deviceIp === d.ip);
                  return (
                    <button
                      key={d.ip}
                      onClick={() => !hasPolicy && selectDevice(d.ip)}
                      disabled={hasPolicy}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-all ${
                        hasPolicy
                          ? "bg-white/5 text-muted-foreground/50 cursor-not-allowed line-through"
                          : newIp === d.ip
                            ? "bg-gold/20 border border-gold/30 text-gold"
                            : "bg-white/5 border border-white/10 text-foreground hover:bg-white/10"
                      }`}
                    >
                      <Monitor className="w-3 h-3" />
                      {d.hostname !== "*" ? d.hostname : d.ip}
                      <span className="text-muted-foreground">({d.ip})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Device IP */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Device IP *</label>
              <input
                type="text"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
              />
            </div>
            {/* Device Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Device Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Smart TV, IoT Camera"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
              />
            </div>
            {/* MAC Address */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">MAC Address</label>
              <input
                type="text"
                value={newMac}
                onChange={(e) => setNewMac(e.target.value)}
                placeholder="AA:BB:CC:DD:EE:FF"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
              />
            </div>
            {/* Policy Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Policy Type *</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewPolicyType("block_outbound")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    newPolicyType === "block_outbound"
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <WifiOff className="w-4 h-4" />
                  Block Outbound
                </button>
                <button
                  onClick={() => setNewPolicyType("block_all")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    newPolicyType === "block_all"
                      ? "bg-red-500/20 border-red-500/40 text-red-400"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Full Block
                </button>
              </div>
            </div>
          </div>

          {/* Policy type description */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-white/3 border border-white/5">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              {POLICY_META[newPolicyType].desc}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Reason (optional)</label>
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="e.g. Suspicious outbound traffic, IoT quarantine"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newIp || createPolicy.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gold/20 border border-gold/30 text-gold hover:bg-gold/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createPolicy.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              Create Policy
            </button>
          </div>
        </GlassCard>
      )}

      {/* ─── Main Content: 2-column on ultrawide ────────────── */}
      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_340px] gap-6">
        {/* ─── Policy Table ─────────────────────────────────── */}
        <GlassCard className="p-0 overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-foreground">Active Policies</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-white/5 text-muted-foreground">
                {filteredPolicies.length} {filteredPolicies.length === 1 ? "policy" : "policies"}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search IP, name, MAC..."
                className="pl-9 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50 w-56"
              />
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_140px_1fr_120px_140px] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-white/5 bg-white/2">
            <span>Device</span>
            <span>Policy</span>
            <span>Reason</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Policy rows */}
          <div className="divide-y divide-white/5">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading policies...
              </div>
            ) : filteredPolicies.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldOff className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery ? "No policies match your search" : "No device policies configured"}
                </p>
                <p className="text-muted-foreground/60 text-xs mt-1">
                  {searchQuery
                    ? "Try a different search term"
                    : "Click \"Add Policy\" to create your first device rule"}
                </p>
              </div>
            ) : (
              filteredPolicies.map((policy) => {
                const meta = POLICY_META[policy.policyType] || POLICY_META.block_outbound;
                const Icon = meta.icon;
                const isEnabled = !!policy.enabled;

                return (
                  <div
                    key={policy.id}
                    className={`grid grid-cols-[1fr_140px_1fr_120px_140px] gap-2 px-4 py-3 items-center transition-all ${
                      isEnabled ? "hover:bg-white/3" : "opacity-50 hover:opacity-70"
                    }`}
                  >
                    {/* Device info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm text-foreground truncate">
                          {policy.deviceIp}
                        </span>
                      </div>
                      {(policy.deviceName || policy.macAddress) && (
                        <div className="flex items-center gap-2 mt-0.5 ml-6">
                          {policy.deviceName && (
                            <span className="text-xs text-muted-foreground truncate">
                              {policy.deviceName}
                            </span>
                          )}
                          {policy.macAddress && (
                            <span className="text-xs font-mono text-muted-foreground/60 truncate">
                              {policy.macAddress}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Policy type */}
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <span className={`text-xs font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>

                    {/* Reason */}
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground truncate block">
                        {policy.reason || "—"}
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          isEnabled
                            ? "bg-green-500/15 text-green-400"
                            : "bg-white/5 text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isEnabled ? "bg-green-400" : "bg-muted-foreground"
                          }`}
                        />
                        {isEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() =>
                          togglePolicy.mutate({
                            id: policy.id,
                            enabled: !isEnabled,
                          })
                        }
                        disabled={togglePolicy.isPending}
                        className={`p-1.5 rounded-md transition-all ${
                          isEnabled
                            ? "text-green-400 hover:bg-green-500/10"
                            : "text-muted-foreground hover:bg-white/10"
                        }`}
                        title={isEnabled ? "Disable policy" : "Enable policy"}
                      >
                        {isEnabled ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove policy for ${policy.deviceIp}? This will unblock the device.`)) {
                            removePolicy.mutate({ id: policy.id });
                          }
                        }}
                        disabled={removePolicy.isPending}
                        className="p-1.5 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Remove policy"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>

        {/* ─── Summary Sidebar ──────────────────────────────── */}
        <div className="space-y-4">
          {/* Stats overview */}
          <GlassCard className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold" />
              Policy Summary
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-white/3 border border-white/5 text-center">
                <div className="text-xl font-bold text-foreground font-mono">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10 text-center">
                <div className="text-xl font-bold text-green-400 font-mono">{stats.enabled}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center">
                <div className="text-xl font-bold text-amber-400 font-mono">{stats.outbound}</div>
                <div className="text-xs text-muted-foreground">Block Out</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-center">
                <div className="text-xl font-bold text-red-400 font-mono">{stats.fullBlock}</div>
                <div className="text-xs text-muted-foreground">Full Block</div>
              </div>
            </div>
          </GlassCard>

          {/* Policy type legend */}
          <GlassCard className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Policy Types</h3>
            <div className="space-y-3">
              {Object.entries(POLICY_META).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <div key={key} className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 ${meta.color} mt-0.5 shrink-0`} />
                    <div>
                      <div className={`text-sm font-medium ${meta.color}`}>{meta.label}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* IOT info */}
          <GlassCard className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wifi className="w-4 h-4 text-blue-400" />
              IOT Mode Info
            </h3>
            <div className="text-xs text-muted-foreground space-y-2">
              <p>
                IOT (Block Outbound) mode adds the device to the <code className="text-gold/80 bg-white/5 px-1 rounded">Skynet-IOT</code> ipset.
                The device can still communicate on the local network but cannot reach the internet.
              </p>
              <p>
                Use the <strong>IOT Config</strong> button to set which ports and protocols IOT-blocked
                devices are still allowed to use (e.g., NTP port 123 for time sync).
              </p>
              <p>
                Skynet commands used:<br />
                <code className="text-gold/80 bg-white/5 px-1 rounded">firewall iot ban [IP]</code><br />
                <code className="text-gold/80 bg-white/5 px-1 rounded">firewall iot unban [IP]</code>
              </p>
            </div>
          </GlassCard>

          {/* Known devices */}
          {devices.length > 0 && (
            <GlassCard className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Monitor className="w-4 h-4 text-cyan-400" />
                Network Devices
                <span className="text-xs font-mono text-muted-foreground ml-auto">{devices.length}</span>
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {devices.map((d) => {
                  const hasPolicy = policies.some((p) => p.deviceIp === d.ip);
                  return (
                    <div
                      key={d.ip}
                      className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                        hasPolicy ? "bg-amber-500/5" : "hover:bg-white/3"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Monitor className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-foreground truncate">
                          {d.hostname !== "*" ? d.hostname : "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{d.ip}</span>
                        {hasPolicy && (
                          <Shield className="w-3 h-3 text-amber-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

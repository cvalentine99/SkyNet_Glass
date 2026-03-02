/**
 * Skynet SSH Client
 *
 * Manages SSH connections to the ASUS Merlin router.
 * Replaces all HTTP-based communication (login.cgi, apply.cgi, cmdRet_check.htm)
 * with direct SSH command execution.
 *
 * Features:
 *   - Connection pooling (reuse a single connection for multiple commands)
 *   - Automatic reconnection on disconnect
 *   - Password and private-key authentication
 *   - Command timeout handling
 *   - Graceful shutdown
 */

import { Client, type ConnectConfig } from "ssh2";

// ─── Types ────────────────────────────────────────────────────

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface SSHExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

// ─── Connection Pool ──────────────────────────────────────────

let activeClient: Client | null = null;
let activeConfig: SSHConfig | null = null;
let connectionPromise: Promise<Client> | null = null;
let isShuttingDown = false;

/**
 * Get or create an SSH connection to the router.
 * Reuses the existing connection if it's still alive and config hasn't changed.
 */
async function getConnection(config: SSHConfig): Promise<Client> {
  // If config changed, close old connection
  if (
    activeClient &&
    activeConfig &&
    (activeConfig.host !== config.host ||
      activeConfig.port !== config.port ||
      activeConfig.username !== config.username ||
      activeConfig.password !== config.password)
  ) {
    await closeConnection();
  }

  // Return existing connection if alive — verify with a lightweight check
  if (activeClient) {
    // Verify the underlying socket is still writable
    const sock = (activeClient as any)._sock || (activeClient as any)._sshstream?._writableState;
    const isAlive = activeClient.listenerCount('close') > 0;
    if (isAlive) {
      return activeClient;
    }
    // Connection is stale — clean up and reconnect
    console.log("[SSH] Stale connection detected, reconnecting...");
    activeClient = null;
    activeConfig = null;
  }

  // If a connection attempt is already in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Create new connection
  connectionPromise = new Promise<Client>((resolve, reject) => {
    const client = new Client();
    const timeout = setTimeout(() => {
      client.end();
      reject(new Error("SSH connection timed out after 10s"));
    }, 10000);

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 10000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
    };

    // Prefer password auth (most common for ASUS routers)
    if (config.password) {
      connectConfig.password = config.password;
    }
    if (config.privateKey) {
      connectConfig.privateKey = config.privateKey;
    }

    client.on("ready", () => {
      clearTimeout(timeout);
      activeClient = client;
      activeConfig = { ...config };
      connectionPromise = null;
      console.log(`[SSH] Connected to ${config.host}:${config.port}`);
      resolve(client);
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      activeClient = null;
      activeConfig = null;
      connectionPromise = null;
      console.error(`[SSH] Connection error: ${err.message}`);
      reject(err);
    });

    client.on("close", () => {
      activeClient = null;
      activeConfig = null;
      connectionPromise = null;
      if (!isShuttingDown) {
        console.log("[SSH] Connection closed");
      }
    });

    client.on("end", () => {
      activeClient = null;
      activeConfig = null;
      connectionPromise = null;
    });

    client.connect(connectConfig);
  });

  return connectionPromise;
}

/**
 * Execute a command on the router via SSH.
 * Automatically connects/reconnects as needed.
 */
export async function sshExec(
  config: SSHConfig,
  command: string,
  options?: { timeout?: number }
): Promise<SSHExecResult> {
  const timeoutMs = options?.timeout || 30000;

  // Try to get connection, with one retry on failure
  let client: Client;
  try {
    client = await getConnection(config);
  } catch (firstErr) {
    // Connection failed — reset and try once more
    await closeConnection();
    try {
      client = await getConnection(config);
    } catch (retryErr: any) {
      throw new Error(`SSH connection failed: ${retryErr.message}`);
    }
  }

  return new Promise<SSHExecResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`SSH command timed out after ${timeoutMs / 1000}s: ${command.slice(0, 80)}`));
    }, timeoutMs);

    client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        // If exec fails, the connection may be stale — close it
        closeConnection();
        reject(new Error(`SSH exec error: ${err.message}`));
        return;
      }

      let stdout = "";
      let stderr = "";

      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on("close", (code: number) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, code: code ?? 0 });
      });

      stream.on("error", (streamErr: Error) => {
        clearTimeout(timer);
        reject(new Error(`SSH stream error: ${streamErr.message}`));
      });
    });
  });
}

/**
 * Test SSH connectivity to the router.
 * Returns a diagnostic result with model info if successful.
 */
export async function testSSHConnection(config: SSHConfig): Promise<{
  success: boolean;
  message: string;
  details?: {
    model?: string;
    firmware?: string;
    skynetInstalled?: boolean;
    statsExists?: boolean;
    uptime?: string;
  };
}> {
  try {
    // Step 1: Test basic connectivity (use 'echo' — BusyBox on Merlin doesn't have whoami)
    const probe = await sshExec(config, "echo OK", { timeout: 10000 });
    if (probe.code !== 0 || !probe.stdout.includes("OK")) {
      return { success: false, message: `SSH connected but command execution failed: ${probe.stderr}` };
    }

    // Step 2: Get router model and firmware
    const nvram = await sshExec(
      config,
      'nvram get productid 2>/dev/null && echo "---" && nvram get buildno 2>/dev/null && echo "---" && nvram get extendno 2>/dev/null',
      { timeout: 10000 }
    );
    const nvramParts = nvram.stdout.split("---").map((s) => s.trim());
    const model = nvramParts[0] || "Unknown";
    const buildno = nvramParts[1] || "";
    const extendno = nvramParts[2] || "";
    const firmware = [buildno, extendno].filter(Boolean).join("_") || "Unknown";

    // Step 3: Check if Skynet is installed
    const skynetCheck = await sshExec(
      config,
      "[ -f /jffs/scripts/firewall ] && echo 'INSTALLED' || echo 'NOT_FOUND'",
      { timeout: 5000 }
    );
    const skynetInstalled = skynetCheck.stdout.trim() === "INSTALLED";

    // Step 4: Check if stats.js exists
    const statsCheck = await sshExec(
      config,
      "[ -f /tmp/var/wwwext/skynet/stats.js ] && echo 'EXISTS' || echo 'NOT_FOUND'",
      { timeout: 5000 }
    );
    const statsExists = statsCheck.stdout.trim() === "EXISTS";

    // Step 5: Get uptime
    const uptimeResult = await sshExec(config, "uptime", { timeout: 5000 });
    const uptime = uptimeResult.stdout.trim();

    return {
      success: true,
      message: `Connected to ${model} (firmware ${firmware})`,
      details: {
        model,
        firmware,
        skynetInstalled,
        statsExists,
        uptime,
      },
    };
  } catch (err: any) {
    // Provide specific error messages
    const msg = err.message || String(err);
    if (msg.includes("Authentication failed") || msg.includes("All configured authentication methods failed")) {
      return { success: false, message: "Authentication failed — check username and password" };
    }
    if (msg.includes("timed out")) {
      return { success: false, message: "Connection timed out — check router IP and SSH port" };
    }
    if (msg.includes("ECONNREFUSED")) {
      return { success: false, message: "Connection refused — is SSH enabled on the router?" };
    }
    if (msg.includes("EHOSTUNREACH") || msg.includes("ENETUNREACH")) {
      return { success: false, message: "Host unreachable — check network connectivity to router" };
    }
    return { success: false, message: `SSH connection failed: ${msg}` };
  }
}

/**
 * Close the active SSH connection.
 */
export async function closeConnection(): Promise<void> {
  isShuttingDown = true;
  if (activeClient) {
    try {
      activeClient.end();
    } catch {
      // Ignore close errors
    }
    activeClient = null;
    activeConfig = null;
  }
  connectionPromise = null;
  isShuttingDown = false;
}

/**
 * Check if there's an active SSH connection.
 */
export function isConnected(): boolean {
  return activeClient !== null;
}

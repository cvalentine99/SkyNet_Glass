import { describe, expect, it } from "vitest";
import { testSSHConnection, type SSHConfig } from "./skynet-ssh";

/**
 * SSH Authentication Tests
 *
 * These tests verify the SSH client's error handling and diagnostic messages.
 * They don't require a real router — they test that connection failures
 * produce clear, actionable error messages.
 */

describe("SSH Authentication", () => {
  it("testSSHConnection returns structured result on refused connection", async () => {
    // Use localhost with a definitely-closed port for fast failure
    const result = await testSSHConnection({
      host: "127.0.0.1",
      port: 59998,
      username: "admin",
      password: "wrong",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  }, 15000);

  it("testSSHConnection returns structured result on refused port", async () => {
    const result = await testSSHConnection({
      host: "127.0.0.1",
      port: 59999,
      username: "admin",
      password: "test",
    });
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
    expect(
      result.message.toLowerCase().includes("refused") ||
      result.message.toLowerCase().includes("failed") ||
      result.message.toLowerCase().includes("timed out")
    ).toBe(true);
  }, 15000);

  it("SSHConfig type requires host, port, username", () => {
    const config: SSHConfig = {
      host: "192.168.50.1",
      port: 22,
      username: "admin",
    };
    expect(config.host).toBe("192.168.50.1");
    expect(config.port).toBe(22);
    expect(config.username).toBe("admin");
    expect(config.password).toBeUndefined();
  });

  it("SSHConfig accepts optional password and privateKey", () => {
    const config: SSHConfig = {
      host: "192.168.50.1",
      port: 22,
      username: "admin",
      password: "mypassword",
      privateKey: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----",
    };
    expect(config.password).toBe("mypassword");
    expect(config.privateKey).toBeDefined();
  });

  it("SSHConfig supports custom ports", () => {
    const config: SSHConfig = {
      host: "10.0.0.1",
      port: 2222,
      username: "root",
    };
    expect(config.port).toBe(2222);
  });
});

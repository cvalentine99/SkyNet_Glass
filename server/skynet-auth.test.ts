import { describe, expect, it } from "vitest";
import { buildAuthHeaders } from "./skynet-fetcher";

describe("buildAuthHeaders", () => {
  it("returns empty object when username is null", () => {
    expect(buildAuthHeaders(null, "password")).toEqual({});
  });

  it("returns empty object when username is undefined", () => {
    expect(buildAuthHeaders(undefined, "password")).toEqual({});
  });

  it("returns empty object when username is empty string", () => {
    expect(buildAuthHeaders("", "password")).toEqual({});
  });

  it("returns Authorization header with valid credentials", () => {
    const result = buildAuthHeaders("admin", "secret123");
    // Base64 of "admin:secret123" = "YWRtaW46c2VjcmV0MTIz"
    expect(result).toEqual({
      Authorization: "Basic YWRtaW46c2VjcmV0MTIz",
    });
  });

  it("handles password with special characters", () => {
    const result = buildAuthHeaders("admin", "p@ss:w0rd!");
    const expected = Buffer.from("admin:p@ss:w0rd!").toString("base64");
    expect(result).toEqual({
      Authorization: `Basic ${expected}`,
    });
  });

  it("handles null password (sends username with empty password)", () => {
    const result = buildAuthHeaders("admin", null);
    // Base64 of "admin:" = "YWRtaW46"
    expect(result).toEqual({
      Authorization: "Basic YWRtaW46",
    });
  });

  it("handles undefined password (sends username with empty password)", () => {
    const result = buildAuthHeaders("admin", undefined);
    expect(result).toEqual({
      Authorization: "Basic YWRtaW46",
    });
  });

  it("handles unicode characters in credentials", () => {
    const result = buildAuthHeaders("admin", "pässwörd");
    const expected = Buffer.from("admin:pässwörd").toString("base64");
    expect(result).toEqual({
      Authorization: `Basic ${expected}`,
    });
  });
});

import { describe, it, expect } from "vitest";

describe("Google Sheets API Authentication", () => {
  it("should have required environment variables set", () => {
    const projectId = process.env.GOOGLE_SHEETS_PROJECT_ID;
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

    expect(projectId).toBeDefined();
    expect(projectId).toBe("enhanced-prism-419102");

    expect(clientEmail).toBeDefined();
    expect(clientEmail).toContain("@enhanced-prism-419102.iam.gserviceaccount.com");

    expect(privateKey).toBeDefined();
    expect(privateKey).toBeTruthy();
    expect(privateKey!.length).toBeGreaterThan(100);
  });

  it("should have valid private key format", () => {
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    if (!privateKey) throw new Error("GOOGLE_SHEETS_PRIVATE_KEY not set");

    // Private key should contain key material (either escaped or not)
    const hasKeyPattern = privateKey.includes("MIIEv") || privateKey.includes("BEGIN PRIVATE KEY");
    expect(hasKeyPattern).toBe(true);
    
    // Should be long enough to be a real key
    expect(privateKey.length).toBeGreaterThan(1000);
  });
});

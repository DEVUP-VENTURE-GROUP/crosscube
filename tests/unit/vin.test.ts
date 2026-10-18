import { describe, expect, it } from "vitest";
import { checkVin, normalizeVin } from "@/modules/vehicles/vin";

describe("VIN validation", () => {
  it("accepts a VIN with a correct check digit", () => {
    expect(checkVin("1M8GDM9AXKP042788")).toEqual({ status: "valid", checkDigit: "match" });
    expect(checkVin("11111111111111111")).toEqual({ status: "valid", checkDigit: "match" });
  });

  it("flags check digit mismatches without rejecting the VIN", () => {
    expect(checkVin("1M8GDM9A1KP042788")).toEqual({ status: "valid", checkDigit: "mismatch" });
  });

  it("rejects wrong length and forbidden letters", () => {
    expect(checkVin("1M8GDM9AXKP04278").status).toBe("invalid");
    expect(checkVin("1M8GDM9AXKP04278O")).toMatchObject({ status: "invalid", message: expect.stringContaining("I, O or Q") });
    expect(checkVin("1M8GDM9AXKP04278*").status).toBe("invalid");
  });

  it("treats blank as empty and normalizes spacing and case", () => {
    expect(checkVin("   ")).toEqual({ status: "empty" });
    expect(normalizeVin(" 1m8gdm9a xkp-042788 ")).toBe("1M8GDM9AXKP042788");
  });
});

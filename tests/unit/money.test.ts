import { describe, expect, it } from "vitest";
import {
  applyRatePpm,
  centsToInput,
  divRoundHalfUp,
  formatCents,
  formatQuantity,
  formatRatePpm,
  multiplyQuantity,
  parseMoneyToCents,
  parsePercentToPpm,
  parseQuantityToMilli,
} from "@/lib/money/money";

describe("money", () => {
  it("rounds half up, symmetric for negatives", () => {
    expect(divRoundHalfUp(5n, 10n)).toBe(1n);
    expect(divRoundHalfUp(4n, 10n)).toBe(0n);
    expect(divRoundHalfUp(-5n, 10n)).toBe(-1n);
    expect(divRoundHalfUp(15n, 10n)).toBe(2n);
  });

  it("multiplies fractional quantities without floating point error", () => {
    expect(multiplyQuantity(6000, 1560)).toBe(9360);
    expect(multiplyQuantity(1500, 333)).toBe(500);
    expect(multiplyQuantity(333, 100)).toBe(33);
    expect(multiplyQuantity(5, 100)).toBe(1);
    expect(multiplyQuantity(3000, 10)).toBe(30);
  });

  it("avoids the 0.1 + 0.2 class of float errors", () => {
    expect(parseMoneyToCents("0.10")! + parseMoneyToCents("0.20")!).toBe(30);
    expect(multiplyQuantity(3000, 1001)).toBe(3003);
  });

  it("applies tax rates in parts per million with half-up rounding", () => {
    expect(applyRatePpm(13_415, 80_000)).toBe(1073);
    expect(applyRatePpm(1_000, 82_500)).toBe(83);
    expect(applyRatePpm(1_250, 60_000)).toBe(75);
    expect(applyRatePpm(25, 20_000)).toBe(1);
    expect(applyRatePpm(24, 20_000)).toBe(0);
  });

  it("parses user-entered money strictly", () => {
    expect(parseMoneyToCents("15.60")).toBe(1560);
    expect(parseMoneyToCents("$1,234.5")).toBe(123_450);
    expect(parseMoneyToCents("15.")).toBe(1500);
    expect(parseMoneyToCents(".5")).toBe(50);
    expect(parseMoneyToCents("15.605")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("-5")).toBeNull();
  });

  it("parses quantities and percentages", () => {
    expect(parseQuantityToMilli("6")).toBe(6000);
    expect(parseQuantityToMilli("1.25")).toBe(1250);
    expect(parseQuantityToMilli("0.0005")).toBeNull();
    expect(parsePercentToPpm("8")).toBe(80_000);
    expect(parsePercentToPpm("8.875%")).toBe(88_750);
  });

  it("formats values for display", () => {
    expect(formatCents(27_278)).toBe("$272.78");
    expect(formatCents(123_456_789)).toBe("$1,234,567.89");
    expect(formatCents(-5)).toBe("-$0.05");
    expect(formatCents(0)).toBe("$0.00");
    expect(centsToInput(1560)).toBe("15.60");
    expect(formatQuantity(6000)).toBe("6");
    expect(formatQuantity(1250)).toBe("1.25");
    expect(formatRatePpm(80_000)).toBe("8%");
    expect(formatRatePpm(88_750)).toBe("8.875%");
  });
});

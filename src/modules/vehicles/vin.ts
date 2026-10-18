const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export type VinCheck =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "valid"; checkDigit: "match" | "mismatch" };

export function normalizeVin(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

// Only structure and the North American check digit are verified; this says nothing about title, history or ownership.
export function checkVin(input: string): VinCheck {
  const vin = normalizeVin(input);
  if (vin === "") return { status: "empty" };
  if (vin.length !== 17) return { status: "invalid", message: `VIN must be 17 characters (got ${vin.length}).` };
  if (/[IOQ]/.test(vin)) return { status: "invalid", message: "VIN cannot contain the letters I, O or Q." };
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { status: "invalid", message: "VIN may only contain letters and digits." };

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i]!;
    const value = /\d/.test(char) ? Number(char) : TRANSLITERATION[char]!;
    sum += value * WEIGHTS[i]!;
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return { status: "valid", checkDigit: vin[8] === expected ? "match" : "mismatch" };
}

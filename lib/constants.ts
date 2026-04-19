export const PAYMENT_TYPES = [
  { value: "nakit",       label: "Nakit" },
  { value: "kredi_karti", label: "Kredi Kartı" },
  { value: "havale",      label: "Havale / EFT" },
] as const;

export type PaymentTypeValue = typeof PAYMENT_TYPES[number]["value"];

export const PAY_LABEL: Record<string, string> = {
  nakit:       "Nakit",
  kredi_karti: "Kredi Kartı",
  havale:      "Havale/EFT",
  borc:        "Borç",
};

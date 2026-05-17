import crypto from "crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

const pickFrom = (charset: string): string => {
  const idx = crypto.randomInt(0, charset.length);
  return charset[idx]!;
};

const shuffle = (input: string): string => {
  const arr = input.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.join("");
};

export const generateTempPassword = (length = 16): string => {
  if (length < 8) throw new Error("Temp password length must be >= 8");

  const required = [
    pickFrom(UPPER),
    pickFrom(LOWER),
    pickFrom(DIGITS),
    pickFrom(SYMBOLS),
  ];

  const remaining = Array.from({ length: length - required.length }, () =>
    pickFrom(ALL)
  );

  return shuffle([...required, ...remaining].join(""));
};

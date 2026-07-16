import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope } from "./types.js";

const valid = {
  schemaVersion: 1, encryptionVersion: 1, kdf: "PBKDF2-SHA256", iterations: 310_000,
  salt: "c2FsdA==", iv: "aXY=", ciphertext: "Y2lwaGVy",
  contentHash: "a".repeat(64), byteSize: 6,
};

test("accepts a supported opaque envelope", () => {
  assert.deepEqual(parseEnvelope(valid), valid);
});

test("rejects weak key derivation", () => {
  assert.throws(() => parseEnvelope({ ...valid, iterations: 1_000 }), /Iterationszahl/);
});

test("rejects malformed hashes and unknown KDFs", () => {
  assert.throws(() => parseEnvelope({ ...valid, contentHash: "nope" }), /contentHash/);
  assert.throws(() => parseEnvelope({ ...valid, kdf: "plain" }), /KDF/);
});

const ENS_RPC = "https://eth.llamarpc.com";

// Minimal ENS reverse resolution via eth_call to the ENS Universal Resolver
// Uses the public reverse registrar approach
export async function resolveEnsNames(
  addresses: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Batch in groups of 20 to avoid rate limits
  const batchSize = 20;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const promises = batch.map(async (addr) => {
      try {
        const name = await reverseResolve(addr);
        if (name) results.set(addr.toLowerCase(), name);
      } catch {
        // Skip failed resolutions
      }
    });
    await Promise.all(promises);

    // Small delay between batches
    if (i + batchSize < addresses.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

async function reverseResolve(address: string): Promise<string | null> {
  // ENS reverse resolver: call the reverse registrar
  // node = namehash(addr.reverse)
  const addr = address.toLowerCase().slice(2);
  const reverseName = `${addr}.addr.reverse`;
  const node = await namehash(reverseName);

  // Call the ENS registry to get the resolver
  // ENS Registry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
  const resolverAddr = await getResolver(node);
  if (!resolverAddr || resolverAddr === "0x" + "0".repeat(40)) return null;

  // Call name(bytes32) on the resolver
  const nameSelector = "0x691f3431"; // name(bytes32)
  const calldata = nameSelector + node.slice(2);

  const res = await ethCall(resolverAddr, calldata);
  if (!res || res === "0x") return null;

  return decodeString(res);
}

async function getResolver(node: string): Promise<string | null> {
  const registryAddr = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
  const resolverSelector = "0x0178b8bf"; // resolver(bytes32)
  const calldata = resolverSelector + node.slice(2);

  const res = await ethCall(registryAddr, calldata);
  if (!res || res.length < 66) return null;

  return "0x" + res.slice(26, 66);
}

async function ethCall(to: string, data: string): Promise<string | null> {
  const res = await fetch(ENS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to, data }, "latest"],
      id: 1,
    }),
  });
  const json = await res.json();
  return json.result || null;
}

function decodeString(hex: string): string | null {
  try {
    const data = hex.slice(2);
    // ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
    const offset = parseInt(data.slice(0, 64), 16) * 2;
    const length = parseInt(data.slice(offset, offset + 64), 16);
    const strHex = data.slice(offset + 64, offset + 64 + length * 2);
    const bytes = new Uint8Array(
      strHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
    );
    const result = new TextDecoder().decode(bytes);
    return result || null;
  } catch {
    return null;
  }
}

async function namehash(name: string): Promise<string> {
  let node = new Uint8Array(32); // 0x00...00
  if (name) {
    const labels = name.split(".");
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = await sha256(new TextEncoder().encode(labels[i]));
      const combined = new Uint8Array(64);
      combined.set(node, 0);
      combined.set(new Uint8Array(labelHash), 32);
      node = new Uint8Array(await sha256(combined));
    }
  }
  return "0x" + Array.from(node).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(data: Uint8Array): Promise<ArrayBuffer> {
  // ENS uses keccak256, not sha256. Let me use a simple keccak implementation.
  return keccak256(data);
}

// Minimal keccak-256 implementation
function keccak256(data: Uint8Array): ArrayBuffer {
  const ROUNDS = 24;
  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
    0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
    0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
    0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
    0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
    0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
    0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
  ];
  const ROTC = [
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
    27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
  ];
  const PILN = [
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
    15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
  ];

  const rate = 136; // (1600 - 256*2) / 8

  // Pad the message
  const padLen = rate - (data.length % rate);
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  padded[data.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  // State
  const state = new BigUint64Array(25);

  // Absorb
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let j = 0; j < 8; j++) {
        lane |= BigInt(padded[offset + i * 8 + j]) << BigInt(j * 8);
      }
      state[i] ^= lane;
    }

    // Keccak-f[1600]
    for (let round = 0; round < ROUNDS; round++) {
      // θ
      const C = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
      }
      const D = new BigUint64Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ rot64(C[(x + 1) % 5], 1);
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 25; y += 5) {
          state[y + x] ^= D[x];
        }
      }

      // ρ and π
      let t = state[1];
      for (let i = 0; i < 24; i++) {
        const j = PILN[i];
        const tmp = state[j];
        state[j] = rot64(t, ROTC[i]);
        t = tmp;
      }

      // χ
      for (let y = 0; y < 25; y += 5) {
        const t0 = state[y];
        const t1 = state[y + 1];
        const t2 = state[y + 2];
        const t3 = state[y + 3];
        const t4 = state[y + 4];
        state[y] = t0 ^ (~t1 & t2);
        state[y + 1] = t1 ^ (~t2 & t3);
        state[y + 2] = t2 ^ (~t3 & t4);
        state[y + 3] = t3 ^ (~t4 & t0);
        state[y + 4] = t4 ^ (~t0 & t1);
      }

      // ι
      state[0] ^= RC[round];
    }
  }

  // Squeeze (32 bytes for keccak-256)
  const output = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    const lane = state[i];
    for (let j = 0; j < 8; j++) {
      output[i * 8 + j] = Number((lane >> BigInt(j * 8)) & 0xffn);
    }
  }

  return output.buffer;
}

function rot64(x: bigint, n: number): bigint {
  const mask = 0xffffffffffffffffn;
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & mask;
}

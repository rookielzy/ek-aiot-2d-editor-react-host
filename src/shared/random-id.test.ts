import { afterEach, describe, expect, it, vi } from "vitest";

import { createRandomId } from "./random-id";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createRandomId", () => {
  it("uses crypto.randomUUID when the secure-context API is available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "00000000-0000-4000-8000-000000000001",
    });

    expect(createRandomId()).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("creates a UUID v4 with getRandomValues when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues(array: Uint8Array) {
        array.set(Array.from({ length: 16 }, (_, index) => index));
        return array;
      },
    });

    expect(createRandomId()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });
});

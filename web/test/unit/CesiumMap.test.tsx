import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CesiumMap } from "../../src/shared/CesiumMap";

// Mocks Cesium entirely so this test can run without a real WebGL context,
// and so it can directly capture and invoke the callbacks the real
// component registers — the only way to prove behavior rather than just
// reasoning about it.
let capturedClickCallback: ((movement: any) => void) | null = null;
let capturedTileVisibleCallback: ((tile: any) => void) | null = null;
let fakePickedElementId: string | number | undefined;

function makeFakeFeature(elementId: string | number) {
  return {
    color: undefined as any,
    getProperty: (name: string) => (name === "elementId" ? elementId : undefined),
  };
}

function makeFakeTile(features: ReturnType<typeof makeFakeFeature>[]) {
  return {
    content: {
      featuresLength: features.length,
      getFeature: (i: number) => features[i],
    },
  };
}

class FakeTileset {
  tileVisible = {
    addEventListener: (cb: any) => {
      capturedTileVisibleCallback = cb;
    },
  };
}

vi.mock("cesium", () => {
  class FakeViewer {
    scene = {
      primitives: { add: vi.fn() },
      pick: vi.fn(() => ({
        getProperty: (name: string) => (name === "elementId" ? fakePickedElementId : undefined),
      })),
      renderError: { addEventListener: vi.fn() },
    };
    camera = { flyTo: vi.fn() };
    screenSpaceEventHandler = {
      setInputAction: (callback: any) => {
        capturedClickCallback = callback;
      },
    };
    isDestroyed = () => false;
    destroy = vi.fn();
    useDefaultRenderLoop = true;
  }

  return {
    Viewer: FakeViewer,
    Ion: { defaultAccessToken: "" },
    Terrain: { fromWorldTerrain: vi.fn() },
    Cartesian3: { fromDegrees: vi.fn() },
    ScreenSpaceEventType: { LEFT_CLICK: "LEFT_CLICK" },
    createOsmBuildingsAsync: vi.fn(() => Promise.resolve(new FakeTileset())),
    // Returns the hex string itself, so tests can assert exactly which
    // color a feature ended up with.
    Color: { fromCssColorString: vi.fn((hex: string) => hex) },
  };
});

describe("CesiumMap — click handler closure", () => {
  it("REGRESSION: calls the most recently provided onSelectBuilding, not a stale one captured at first mount", async () => {
    fakePickedElementId = "999";

    const firstOnSelect = vi.fn();
    const secondOnSelect = vi.fn();

    const { rerender } = render(
      <CesiumMap dataByOsmId={{}} colorMap={{}} onSelectBuilding={firstOnSelect} />
    );
    await act(async () => {}); // let createOsmBuildingsAsync's promise resolve

    // Simulate the parent re-rendering with fresh data/state (exactly what
    // happens once the real building list finishes loading), which passes
    // a new onSelectBuilding closure — the setup effect must not have
    // pinned itself to the very first one.
    rerender(<CesiumMap dataByOsmId={{}} colorMap={{}} onSelectBuilding={secondOnSelect} />);

    expect(capturedClickCallback).not.toBeNull();
    capturedClickCallback!({ position: { x: 0, y: 0 } });

    expect(secondOnSelect).toHaveBeenCalledWith("999");
    expect(firstOnSelect).not.toHaveBeenCalled();
  });
});

describe("CesiumMap — per-feature coloring at scale", () => {
  it("colors a visible feature according to dataByOsmId and colorMap", async () => {
    render(
      <CesiumMap
        dataByOsmId={{ "101": "F" }}
        colorMap={{ F: "#D85A30" }}
        onSelectBuilding={vi.fn()}
      />
    );
    await act(async () => {});

    const feature = makeFakeFeature("101");
    const tile = makeFakeTile([feature]);
    expect(capturedTileVisibleCallback).not.toBeNull();
    capturedTileVisibleCallback!(tile);

    expect(feature.color).toBe("#D85A30");
  });

  it("uses the fallback color for a feature with no matching entry in dataByOsmId", async () => {
    render(<CesiumMap dataByOsmId={{}} colorMap={{ F: "#D85A30" }} onSelectBuilding={vi.fn()} />);
    await act(async () => {});

    const feature = makeFakeFeature("999999");
    const tile = makeFakeTile([feature]);
    capturedTileVisibleCallback!(tile);

    expect(feature.color).toBe("#D3D1C7"); // the neutral fallback
  });

  it("REGRESSION: handles a real-scale dataset (tens of thousands of buildings) without throwing", async () => {
    // This is the actual bug, reproduced at scale: the previous
    // expression-based approach built one condition per matched building
    // into a single Cesium3DTileStyle expression string. At 54,466 real
    // matched buildings, Cesium's expression parser (a recursive-descent
    // parser over that OR-chain) overflowed the JS call stack and crashed
    // the whole map. Per-feature coloring has no such limit — dataByOsmId
    // is just a plain object lookup, regardless of how large it is.
    const largeDataByOsmId: Record<string, string> = {};
    for (let i = 0; i < 60000; i++) {
      largeDataByOsmId[String(i)] = i % 2 === 0 ? "F" : "C";
    }

    expect(() => {
      render(
        <CesiumMap
          dataByOsmId={largeDataByOsmId}
          colorMap={{ F: "#D85A30", C: "#639922" }}
          onSelectBuilding={vi.fn()}
        />
      );
    }).not.toThrow();

    await act(async () => {});

    const feature = makeFakeFeature("40000"); // even -> "F"
    const tile = makeFakeTile([feature]);
    expect(() => capturedTileVisibleCallback!(tile)).not.toThrow();
    expect(feature.color).toBe("#D85A30");
  });

  it("REGRESSION: the next tileVisible firing picks up updated dataByOsmId after a rerender, since forEachLoadedTile is not reliably available", async () => {
    // Cesium's tileVisible fires once per visible tile on every rendered
    // frame (confirmed directly from Cesium's own docs), and the viewer
    // renders continuously by default — so re-coloring on a filter change
    // doesn't need any separate "re-color already-loaded tiles" step, it
    // just needs colorizeTile to read current refs, which get updated on
    // every render regardless of the effect's own dependency array.
    const feature = makeFakeFeature("101");

    const { rerender } = render(
      <CesiumMap dataByOsmId={{ "101": "C" }} colorMap={{ C: "#639922", F: "#D85A30" }} onSelectBuilding={vi.fn()} />
    );
    await act(async () => {});

    capturedTileVisibleCallback!(makeFakeTile([feature]));
    expect(feature.color).toBe("#639922");

    rerender(
      <CesiumMap dataByOsmId={{ "101": "F" }} colorMap={{ C: "#639922", F: "#D85A30" }} onSelectBuilding={vi.fn()} />
    );

    // Simulates the next frame's tileVisible firing for the same tile —
    // this is what actually keeps colors in sync in the real browser.
    capturedTileVisibleCallback!(makeFakeTile([feature]));
    expect(feature.color).toBe("#D85A30");
  });
});

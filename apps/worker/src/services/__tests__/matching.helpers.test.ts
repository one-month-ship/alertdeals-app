import { describe, expect, it } from "vitest";
import { splitBrandModelSelection } from "../matching.helpers.js";

// Ids réels pour se repérer : 146 = Toyota, 3 = Citroën, 8 = Peugeot.
const brand = (brandId: number) => ({ brandId });
const model = (modelId: number, brandId: number) => ({
  modelId,
  vehicleModel: { brandId },
});

describe("splitBrandModelSelection", () => {
  it("aucune sélection → aucune contrainte", () => {
    expect(splitBrandModelSelection([], [])).toEqual({
      modelIds: [],
      unrestrictedBrandIds: [],
    });
  });

  it("marques seules → toutes sans restriction (toute la gamme)", () => {
    expect(splitBrandModelSelection([brand(3), brand(146)], [])).toEqual({
      modelIds: [],
      unrestrictedBrandIds: [3, 146],
    });
  });

  it("une marque cochée sans aucun de ses modèles reste sans restriction", () => {
    // Le cas du bug prod (compte 35f8eced, 4 nov. 2026) : Toyota cochée sans
    // modèle Toyota, des utilitaires cochés sur d'autres marques → l'AND
    // global excluait toute Toyota. Ici Toyota (146) doit rester « gamme
    // entière » malgré les modèles Citroën cochés.
    const result = splitBrandModelSelection(
      [brand(3), brand(146)],
      [model(107, 3), model(133, 3)], // C25 et Jumper, tous deux Citroën
    );
    expect(result).toEqual({
      modelIds: [107, 133],
      unrestrictedBrandIds: [146],
    });
  });

  it("chaque marque ayant un modèle coché est restreinte à ses modèles", () => {
    const result = splitBrandModelSelection(
      [brand(3), brand(8)],
      [model(107, 3), model(461, 8)],
    );
    expect(result).toEqual({
      modelIds: [107, 461],
      unrestrictedBrandIds: [],
    });
  });

  it("modèles cochés sans marque (état défensif, l'UI l'empêche) → modèles seuls", () => {
    expect(splitBrandModelSelection([], [model(107, 3)])).toEqual({
      modelIds: [107],
      unrestrictedBrandIds: [],
    });
  });
});

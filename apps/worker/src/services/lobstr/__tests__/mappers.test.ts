import { TAdReferenceData } from "@alertdeals/db";
import {
  EAdGoodDeal,
  EAdOwnerType,
  EAdSource,
  normalizeReferenceName,
} from "@alertdeals/shared";
import { describe, expect, it, vi } from "vitest";
import { mapAutoScout24Ad, TAdFromAutoScout24 } from "../autoscout24.mapper.js";
import { mapLaCentraleAd, TAdFromLaCentrale } from "../lacentrale.mapper.js";
import { mapParuVenduAd, TAdFromParuVendu } from "../paruvendu.mapper.js";
import { parsePhone } from "../shared.mapper.js";
import { TDBClient } from "../types.js";

// Fake db: every insert resolves with a fresh id
let nextId = 1000;
const makeDb = () => {
  const returning = vi.fn(async () => [{ id: nextId++ }]);
  const onConflictDoNothing = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values }));
  const select = vi.fn(() => ({
    from: () => ({ where: () => ({ limit: async () => [] }) }),
  }));
  return { insert, select } as unknown as TDBClient;
};

// Mirrors what fetchAllReferenceData builds from the normalized_name columns
const withNormalizedIndexes = (
  ref: Omit<
    TAdReferenceData,
    | "brandsByNormalizedName"
    | "brandNamesById"
    | "vehicleModelsByNormalizedName"
  >,
): TAdReferenceData => ({
  ...ref,
  brandsByNormalizedName: new Map(
    Array.from(ref.brands.entries()).map(([name, id]) => [
      normalizeReferenceName(name),
      id,
    ]),
  ),
  brandNamesById: new Map(
    Array.from(ref.brands.entries()).map(([name, id]) => [id, name]),
  ),
  vehicleModelsByNormalizedName: new Map(
    Array.from(ref.vehicleModels.entries()).map(([key, id]) => {
      const [brandId, name] = key.split(/:(.*)/s);
      return [`${brandId}:${normalizeReferenceName(name ?? "")}`, id];
    }),
  ),
});

const makeReferenceData = (): TAdReferenceData =>
  withNormalizedIndexes({
    adTypes: new Map([
      ["Voitures", 1],
      ["Motos", 2],
      ["Utilitaires", 3],
    ]),
    adSubTypes: new Map([
      ["Berline", 1],
      ["4x4, SUV & Crossover", 4],
      ["Coupé", 6],
    ]),
    brands: new Map([
      ["TOYOTA", 10],
      ["PORSCHE", 11],
    ]),
    vehicleModels: new Map([
      ["10:Land Cruiser", 100],
      ["11:911", 101],
    ]),
    marketPositions: new Map([
    ["Très bonne affaire", 5],
    ["Bonne affaire", 4],
    ["Prix équitable", 3],
  ]),
    zipcodes: new Map([
      ["73431", 50],
      ["06800", 51],
      ["75019", 52],
    ]),
    gearBoxes: new Map([
      ["Manuelle", 1],
      ["Automatique", 2],
    ]),
    drivingLicences: new Map(),
    fuels: new Map([
      ["Essence", 1],
      ["Diesel", 2],
      ["Hybride", 3],
    ]),
    vehicleSeats: new Map([
      ["4", 4],
      ["5", 5],
      ["7 ou plus", 7],
    ]),
    vehicleStates: new Map([
      ["Endommagé", 1],
      ["Non endommagé", 2],
    ]),
  });

describe("parsePhone", () => {
  it("parses a French mobile in national format", () => {
    expect(parsePhone("06 12 34 56 78")).toEqual({
      phoneNumber: "+33612345678",
      hasPhone: true,
    });
  });

  it("parses an international number without the leading +", () => {
    const result = parsePhone("33451127621");
    expect(result.phoneNumber).toBe("+33451127621");
  });

  it("keeps foreign numbers with their own country code", () => {
    expect(parsePhone("+497361930114").phoneNumber).toBe("+497361930114");
  });

  it("returns no phone for empty input", () => {
    expect(parsePhone(null)).toEqual({
      phoneNumber: null,
      hasPhone: false,
    });
  });
});

describe("mapAutoScout24Ad", () => {
  const ad: TAdFromAutoScout24 = {
    listing_id: "22c73c4a-a00e-4efd-bfdf-c331d650a421",
    url: "https://www.autoscout24.com/offers/toyota-land-cruiser",
    title: "2,8l Diesel 48V Executive LAGER",
    subtitle: null,
    make: "Toyota",
    model: "Land Cruiser",
    price: 79950,
    currency: "EUR",
    mileage: 5000,
    fuel_type: "Diesel",
    first_registration: "12/2025",
    power: "151 kW (205 hp)",
    seller_type: "Dealer",
    seller_name: "Autohaus Geschw.Schneider GmbH",
    location: "Aalen",
    postal_code: "73431",
    description: "Getriebe Automatik",
    phone: "+497361930114",
    price_label: null,
    gearbox: "Automatic",
    body_type: "SUV/Off-Road/Pick-Up",
    doors: 5,
    seats: 5,
    displacement_cc: 2755,
    cylinders: 4,
    weight_kg: null,
    emission_class: "Euro 6d",
    emissions_sticker: null,
    fuel_consumption: null,
    drivetrain: "4WD",
    number_of_previous_owners: 1,
    general_inspection: "11/2028",
    last_service: null,
    production_date: null,
    equipment: ["360° camera", "Air conditioning"],
    colour: "Grey",
    manufacturer_colour: null,
    paint: null,
    upholstery: null,
    upholstery_colour: null,
    version: null,
    image_urls: ["https://img/1.webp", "https://img/2.webp"],
    image_count: 2,
    vehicle_type: "Car",
    listing_country: "DE",
    position: 4,
    first_online_date: "2026-03-22T13:00:19+00:00",
  };

  it("maps the listing to an ads row", async () => {
    const result = await mapAutoScout24Ad(makeDb(), ad, makeReferenceData());

    expect(result).toMatchObject({
      source: EAdSource.AUTOSCOUT24,
      originalAdId: ad.listing_id,
      price: 79950,
      mileage: 5000,
      phoneNumber: "+497361930114",
      hasPhone: true,
      typeId: 1,
      brandId: 10,
      modelId: 100,
      locationId: 50,
      gearBoxId: 2,
      fuelId: 2,
      vehicleSeatsId: 5,
      subtypeId: 4,
      modelYear: 2025,
      entryYear: 2025,
      technicalInspectionYear: 2028,
      picture: "https://img/1.webp",
      ownerName: "Autohaus Geschw.Schneider GmbH",
      ownerType: EAdOwnerType.PRO,
    });
  });

  it("maps the French-site vocabulary (autoscout24.fr) and price label", async () => {
    const result = await mapAutoScout24Ad(
      makeDb(),
      {
        ...ad,
        fuel_type: "Diesel",
        gearbox: "Boîte manuelle",
        body_type: "Berline",
        price_label: "Bon prix",
        seller_name: "Particulier",
        seller_type: "PrivateSeller",
      },
      makeReferenceData(),
    );
    expect(result).toMatchObject({
      gearBoxId: 1,
      fuelId: 2,
      subtypeId: 1,
      goodDealName: EAdGoodDeal.GOOD,
      marketPositionId: 4,
      ownerName: "Particulier",
      ownerType: EAdOwnerType.PRIVATE,
      unmappedValues: null,
    });
  });

  it("stores an unknown seller type as null and flags it for review", async () => {
    const result = await mapAutoScout24Ad(
      makeDb(),
      { ...ad, seller_type: "Agence" },
      makeReferenceData(),
    );
    expect(result?.ownerType).toBeNull();
    expect(result?.unmappedValues).toEqual({ ownerType: "Agence" });
  });

  it("prefers the numeric priceEvaluation over the displayed label", async () => {
    const result = await mapAutoScout24Ad(
      makeDb(),
      {
        ...ad,
        price_label: "Pas d'information",
        functions: { json_data: { price: { priceEvaluation: 1 } } },
      },
      makeReferenceData(),
    );
    expect(result).toMatchObject({
      goodDealName: EAdGoodDeal.VERY_GOOD,
      marketPositionId: 5,
    });

    const fair = await mapAutoScout24Ad(
      makeDb(),
      {
        ...ad,
        price_label: null,
        functions: { json_data: { price: { priceEvaluation: 3 } } },
      },
      makeReferenceData(),
    );
    expect(fair?.goodDealName).toBeNull();
    expect(fair?.marketPositionId).toBe(3);
  });

  it("maps the damage flag to the vehicle state", async () => {
    const damaged = await mapAutoScout24Ad(
      makeDb(),
      { ...ad, functions: { json_data: { vehicle: { isCurrentlyDamaged: true } } } },
      makeReferenceData(),
    );
    expect(damaged?.vehicleStateId).toBe(1);

    const undamaged = await mapAutoScout24Ad(
      makeDb(),
      { ...ad, functions: { json_data: { vehicle: { isCurrentlyDamaged: false } } } },
      makeReferenceData(),
    );
    expect(undamaged?.vehicleStateId).toBe(2);

    // Missing flag = not reported as damaged
    const missing = await mapAutoScout24Ad(makeDb(), ad, makeReferenceData());
    expect(missing?.vehicleStateId).toBe(2);
  });

  it("derives boosted and low price from the ad tier and price evaluation", async () => {
    const boosted = await mapAutoScout24Ad(
      makeDb(),
      {
        ...ad,
        functions: { json_data: { adTier: "T20", price: { priceEvaluation: 2 } } },
      },
      makeReferenceData(),
    );
    expect(boosted).toMatchObject({ hasBeenBoosted: true, isLowPrice: true });

    const base = await mapAutoScout24Ad(
      makeDb(),
      {
        ...ad,
        price_label: null,
        functions: { json_data: { adTier: "T10", price: { priceEvaluation: 3 } } },
      },
      makeReferenceData(),
    );
    expect(base).toMatchObject({ hasBeenBoosted: false, isLowPrice: false });
  });

  it("skips listings without a price", async () => {
    const result = await mapAutoScout24Ad(
      makeDb(),
      { ...ad, price: null },
      makeReferenceData(),
    );
    expect(result).toBeNull();
  });

  it("creates unknown brands and models", async () => {
    const db = makeDb();
    const referenceData = makeReferenceData();
    const result = await mapAutoScout24Ad(
      db,
      { ...ad, make: "Cupra", model: "Formentor" },
      referenceData,
    );
    expect(result?.brandId).toBeGreaterThanOrEqual(1000);
    expect(result?.modelId).toBeGreaterThanOrEqual(1000);
    expect(referenceData.brands.get("CUPRA")).toBe(result?.brandId);
  });
});

describe("mapLaCentraleAd", () => {
  const ad: TAdFromLaCentrale = {
    reference: "E118586883",
    listing_url:
      "https://www.lacentrale.fr/auto-occasion-annonce-69118586883.html",
    price: 154990,
    photo_url: "https://image/0.jpg",
    pictures_count: 17,
    make: "PORSCHE",
    model: "911",
    detailed_model: "PORSCHE 911 TYPE 992",
    commercial_name: "911 TYPE 992",
    version: "(992) COUPE 3.0 385 CARRERA BVA7",
    trim_level: "CARRERA",
    motorization: "3.0 385",
    year: 2024,
    mileage: 10930,
    energy: "ESSENCE",
    gearbox: "AUTO",
    doors: 2,
    category: "COUPE",
    family: "AUTO",
    external_color: "gris",
    customer_type: "PRO",
    contact_name: "MOTORSPORT BY TB",
    display_phone: "33451127621",
    country: "FR",
    visit_place: "06",
    is_new: true,
    all_photos: ["https://image/0.jpg", "https://image/1.jpg"],
    good_deal_badge: "GOOD_DEAL",
    first_online_date: "2026-03-20T23:00:00+00:00",
    last_update: "2026-03-22T11:01:13",
    equipment_list: ["Volant cuir", "ABS"],
    all_characteristics: {
      vehicle: { category: "COUPE", seatingCapacity: 4 },
      classified: { zipCode: "06800", refinedQuotation: 126805 },
    },
    options_list: null,
    seller_address: null,
    seller_postal_code: "06800",
    seller_name: "MOTORSPORT BY TB",
    seller_comment: null,
    engine_power_hp: 385,
    number_of_seats: 4,
    first_traffic_date: "2024-10-06",
    critair_level: "1",
    euro_standard: "EURO6",
    price_variation: {
      prices: { current: 154990, initial: 160000, isDropping: true },
    },
    is_first_hand: true,
    number_of_owners: null,
  };

  it("maps the listing to an ads row", async () => {
    const result = await mapLaCentraleAd(makeDb(), ad, makeReferenceData());

    expect(result).toMatchObject({
      source: EAdSource.LACENTRALE,
      originalAdId: "E118586883",
      title: "PORSCHE 911 TYPE 992",
      phoneNumber: "+33451127621",
      typeId: 1,
      brandId: 11,
      modelId: 101,
      locationId: 51,
      gearBoxId: 2,
      fuelId: 1,
      subtypeId: 6,
      modelYear: 2024,
      entryYear: 2024,
      priceHasDropped: true,
      hasBeenReposted: true,
      isLowPrice: false,
      priceMin: 126805,
      goodDealName: EAdGoodDeal.GOOD,
      marketPositionId: 4,
      ownerType: EAdOwnerType.PRO,
    });
    expect(result?.pictures).toHaveLength(2);
  });

  it("maps PART sellers to private", async () => {
    const result = await mapLaCentraleAd(
      makeDb(),
      { ...ad, customer_type: "PART" },
      makeReferenceData(),
    );
    expect(result?.ownerType).toBe(EAdOwnerType.PRIVATE);
  });

  it("maps the real payload vocabulary (SUV_4X4_CROSSOVER, EQUITABLE_DEAL, MANUAL)", async () => {
    const result = await mapLaCentraleAd(
      makeDb(),
      {
        ...ad,
        category: "SUV_4X4_CROSSOVER",
        gearbox: "MANUAL",
        good_deal_badge: "EQUITABLE_DEAL",
        seller_comment: null,
        all_characteristics: {
          ...ad.all_characteristics,
          classified: {
            ...ad.all_characteristics!.classified,
            description: "Description depuis classified",
          },
        },
      },
      makeReferenceData(),
    );
    expect(result).toMatchObject({
      subtypeId: 4,
      gearBoxId: 1,
      goodDealName: null,
      marketPositionId: 3,
      description: "Description depuis classified",
      unmappedValues: null,
    });
  });
});

describe("mapParuVenduAd", () => {
  const ad: TAdFromParuVendu = {
    section: "voiture-occasion",
    make: "Audi",
    model: "A6",
    year: 2024,
    mileage: 4300,
    fuel_type: "Hybride",
    gearbox: "Automatique",
    phone: "0612345678",
    location: "Paris 19",
    postal_code: 75019,
    annonce_type: "vente",
    title: "Audi A6 Avant",
    picture: ["https://img.paruvendu.fr/1.jpg"],
    room_count: null,
    area: null,
    price: 45000,
    currency: "EUR",
    description: "Full description",
    description_preview: "Short",
    reference: "ParuVendu WI176922425",
    updated_at: "03/03/2026 11:22",
    features: ["Toit ouvrant"],
    seller_name: "ALAIN V.",
    seller_url: null,
    seller_ads_count: 3,
    asset_type: null,
    last_publication_date: "03/03/2026",
    dpe_greenhouse: null,
    dpe_energy: null,
    list_infos: null,
    url: "https://www.paruvendu.fr/voiture-occasion/audi/a6/1288906643A1KIVHAP000",
  };

  it("maps the listing to an ads row", async () => {
    const db = makeDb();
    const result = await mapParuVenduAd(db, ad, makeReferenceData());

    expect(result).toMatchObject({
      source: EAdSource.PARUVENDU,
      originalAdId: "WI176922425",
      phoneNumber: "+33612345678",
      typeId: 1,
      locationId: 52,
      gearBoxId: 2,
      fuelId: 3,
      modelYear: 2024,
      ownerName: "ALAIN V.",
      // ParuVendu never says whether the seller is a pro
      ownerType: null,
      description: "Full description",
    });
    expect(result?.initialPublicationDate).toBe(
      new Date("2026-03-03").toDateString(),
    );
  });

  it("falls back to the url id when the reference is missing", async () => {
    const result = await mapParuVenduAd(
      makeDb(),
      { ...ad, reference: null },
      makeReferenceData(),
    );
    expect(result?.originalAdId).toBe("1288906643A1KIVHAP000");
  });

  it("skips real estate listings", async () => {
    const result = await mapParuVenduAd(
      makeDb(),
      { ...ad, section: "immobilier" },
      makeReferenceData(),
    );
    expect(result).toBeNull();
  });
});

describe("brand / model resolution across platforms", () => {
  const baseAd: TAdFromAutoScout24 = {
    listing_id: "x",
    url: "https://as24/x",
    title: "t",
    subtitle: null,
    make: null,
    model: null,
    price: 1000,
    currency: "EUR",
    mileage: 1,
    fuel_type: null,
    first_registration: null,
    power: null,
    seller_type: null,
    seller_name: null,
    location: null,
    postal_code: null,
    description: null,
    phone: null,
    price_label: null,
    gearbox: null,
    body_type: null,
    doors: null,
    seats: null,
    displacement_cc: null,
    cylinders: null,
    weight_kg: null,
    emission_class: null,
    emissions_sticker: null,
    fuel_consumption: null,
    drivetrain: null,
    number_of_previous_owners: null,
    general_inspection: null,
    last_service: null,
    production_date: null,
    equipment: null,
    colour: null,
    manufacturer_colour: null,
    paint: null,
    upholstery: null,
    upholstery_colour: null,
    version: null,
    image_urls: null,
    image_count: null,
    vehicle_type: "Car",
    listing_country: "FR",
    position: null,
    first_online_date: null,
  };

  const referenceWithMercedes = (): TAdReferenceData => {
    const ref = makeReferenceData();
    ref.brands.set("MERCEDES-BENZ", 20);
    ref.brands.set("CITROEN", 21);
    ref.brands.set("LAND-ROVER", 22);
    ref.vehicleModels.set("20:Classe A", 200);
    ref.vehicleModels.set("21:C3 Aircross", 210);
    ref.vehicleModels.set("146:Prius", 300);
    ref.vehicleModels.set("146:Prius+", 301);
    return withNormalizedIndexes(ref);
  };

  it.each([
    ["Mercedes-Benz", 20],
    ["MERCEDES BENZ", 20],
    ["Mercedes", 20],
    ["Citroën", 21],
    ["Land Rover", 22],
    ["toyota", 10],
  ])(
    "matches brand %s without creating a duplicate",
    async (make, expected) => {
      const db = makeDb();
      const ref = referenceWithMercedes();
      const result = await mapAutoScout24Ad(db, { ...baseAd, make }, ref);
      expect(result?.brandId).toBe(expected);
      expect(db.insert).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["Mercedes-Benz", "A-Klasse", 200],
    ["Mercedes-Benz", "CLASSE A", 200],
    ["Mercedes-Benz", "Classe  A", 200],
    ["Citroën", "C3 AIRCROSS", 210],
    ["Citroën", "c3-aircross", 210],
  ])(
    "matches model %s %s without creating a duplicate",
    async (make, model, expected) => {
      const db = makeDb();
      const ref = referenceWithMercedes();
      const result = await mapAutoScout24Ad(
        db,
        { ...baseAd, make, model },
        ref,
      );
      expect(result?.modelId).toBe(expected);
      expect(db.insert).not.toHaveBeenCalled();
    },
  );

  it("keeps '+' so Prius and Prius+ stay distinct models", () => {
    expect(normalizeReferenceName("Prius+")).toBe("PRIUS+");
    expect(normalizeReferenceName("Prius")).toBe("PRIUS");
  });

  it("flags brands and models it had to create for the weekly review", async () => {
    const db = makeDb();
    const ref = referenceWithMercedes();
    await mapAutoScout24Ad(db, { ...baseAd, make: "Xpeng", model: "G6" }, ref);
    const insert = db.insert as unknown as ReturnType<typeof vi.fn>;
    // The fake db shares one `values` mock across inserts: read all its calls
    const valuesMock = insert.mock.results[0]?.value.values as ReturnType<
      typeof vi.fn
    >;
    const valuesCalls = valuesMock.mock.calls.map((call) => call[0]);
    expect(valuesCalls).toEqual([
      { name: "XPENG", lobstrValue: "XPENG", needsReview: true },
      {
        name: "G6",
        lobstrValue: "G6",
        brandId: expect.any(Number),
        needsReview: true,
      },
    ]);
  });

  it("stores raw values that did not map, null when everything mapped", async () => {
    const mapped = await mapAutoScout24Ad(
      makeDb(),
      { ...baseAd, fuel_type: "Diesel", gearbox: "Automatic" },
      makeReferenceData(),
    );
    expect(mapped?.unmappedValues).toBeNull();

    const partial = await mapAutoScout24Ad(
      makeDb(),
      {
        ...baseAd,
        fuel_type: "Wasserstoff",
        gearbox: "Halbautomatik",
        body_type: "Roadster",
      },
      makeReferenceData(),
    );
    expect(partial?.fuelId).toBeNull();
    expect(partial?.unmappedValues).toEqual({
      fuel: "Wasserstoff",
      gearbox: "Halbautomatik",
      bodyType: "Roadster",
    });
  });
});

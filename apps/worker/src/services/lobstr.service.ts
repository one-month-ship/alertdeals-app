import {
  ads as adsTable,
  getDBAdminClient,
  getTableColumns,
  sql,
  TAdInsert,
} from "@alertdeals/db";
import { TAdSource } from "@alertdeals/shared";
import { isRetryableHttpCode } from "../config/index.js";
import { fetchAllReferenceData } from "./ad.service.js";
import { getAdMapper, TRawAd } from "./lobstr/index.js";

const LOBSTR_PLATFORM_FIELD = "lobstrValue" as const;

// Build the `set` payload for upserts: every column except id/createdAt/originalAdId
// is overwritten with the incoming row's value (`excluded.<col>` in Postgres).
const allColumns = getTableColumns(adsTable);
const {
  id: _id,
  createdAt: _createdAt,
  source: _source,
  originalAdId: _origId,
  ...columnsToUpdate
} = allColumns;

const setAdUpdateOnConflict = Object.fromEntries(
  Object.entries(columnsToUpdate).map(([key, column]) => [
    key,
    sql`excluded.${sql.identifier(column.name)}`,
  ]),
);

/**
 * Entry point called by the BullMQ scraping worker after Lobstr posts a webhook.
 */
export const handleLobstrWebhook = async (
  runId: string,
  source: TAdSource,
): Promise<void> => {
  try {
    await saveAdsFromLobstr(runId, source);
  } catch (error) {
    console.error(`[lobstr] failed to ingest run ${runId} (${source})`, error);
    throw error;
  }
};

/**
 * Fetches ads from Lobstr's results API for the given run, maps each ad to our schema,
 * and batch-upserts using `original_ad_id` as the dedup key.
 */
const saveAdsFromLobstr = async (
  runId: string,
  source: TAdSource,
): Promise<void> => {
  const db = getDBAdminClient();

  const ads = await getResultsFromRun(runId);

  // Load all lookup tables once into Maps for O(1) lookup during mapping.
  const referenceData = await fetchAllReferenceData(db, LOBSTR_PLATFORM_FIELD);

  const mapAd = getAdMapper(source);

  // This step to ensure we insert only valid objects to the db query
  // Log every drop: a rejected mapper (unexpected payload shape), a null
  // (deliberate skip, e.g. non-vehicle or no price)
  // would otherwise disappear silently.
  // Mapping en séquentiel (plus de Promise.allSettled) pour la même raison que
  // fetchAllReferenceData : un run plein de marques/modèles inconnus ferait
  // partir autant d'INSERT simultanés que d'annonces — au-delà du pool DB, ces
  // requêtes différées pendent derrière Supavisor (incident 2026-11-03).
  const adsToPersist: TAdInsert[] = [];
  for (const ad of ads) {
    let adData: TAdInsert | null;
    try {
      adData = await mapAd(db, ad, referenceData);
    } catch {
      // Mapper rejeté (payload inattendu) → on saute l'annonce, comme avant.
      continue;
    }
    if (!adData) continue;

    // Everything we ingest today is a car: default to typeId 1 instead of dropping
    if (!adData.typeId) adData.typeId = 1;

    adsToPersist.push(adData);
  }

  if (adsToPersist.length === 0) {
    return;
  }

  // Batch the upsert: a single INSERT with thousands of rows would exceed
  // Postgres' 65534-parameter limit (~40 columns × rows) and blow up.
  const BATCH_SIZE = 500;
  for (let i = 0; i < adsToPersist.length; i += BATCH_SIZE) {
    const batch = adsToPersist.slice(i, i + BATCH_SIZE);
    await db
      .insert(adsTable)
      .values(batch)
      // Ad ids are only unique within a platform, hence the composite target
      .onConflictDoUpdate({
        target: [adsTable.source, adsTable.originalAdId],
        set: setAdUpdateOnConflict,
      });
  }
};

const LOBSTR_RESULTS_URL = "https://api.lobstr.io/v1/results";
const LOBSTR_RESULTS_PAGE_SIZE = 1000;

// L'API Lobstr throttle à ~1 requête/seconde ("Expected available in
// 1 second") : après un redémarrage, les webhooks accumulés partent en rafale
// et se throttlent entre eux (2026-11-03 : ~30 runs perdus en 429). On retente
// donc la page au lieu de condamner tout le run.
const LOBSTR_FETCH_MAX_ATTEMPTS = 4;
const LOBSTR_FETCH_RETRY_BASE_DELAY_MS = 1_500;

// Une tentative par page, re-essayée sur les codes transitoires (429 en tête).
const fetchResultsPage = async (
  runId: string,
  page: number,
): Promise<Response> => {
  let attempt = 1;
  while (true) {
    const response = await fetch(
      `${LOBSTR_RESULTS_URL}?run=${runId}&page=${page}&page_size=${LOBSTR_RESULTS_PAGE_SIZE}`,
      {
        method: "GET",
        headers: {
          Authorization: `Token ${process.env.LOBSTR_API_KEY}`,
          "Content-Type": "application/json;charset=UTF-8",
        },
        // Hard cap: without it a slow-streaming response never times out and the
        // BullMQ job stays "active" forever (undici resets its timer on each chunk).
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!isRetryableHttpCode(response.status) || attempt >= LOBSTR_FETCH_MAX_ATTEMPTS) {
      return response;
    }

    // Consomme le body avant d'abandonner la réponse, sinon undici garde la
    // socket occupée.
    await response.text().catch(() => undefined);
    await new Promise((resolve) =>
      setTimeout(resolve, LOBSTR_FETCH_RETRY_BASE_DELAY_MS * attempt),
    );
    attempt += 1;
  }
};

type TLobstrResultsPage = {
  data?: TRawAd[];
  total_results?: number;
  total_pages?: number;
  page?: number;
};

// Gets all the results of a lobstr run using their API (paginated)
// https://docs.lobstr.io/docs/get-results
const getResultsFromRun = async (runId: string): Promise<TRawAd[]> => {
  const results: TRawAd[] = [];
  let page = 1;

  while (true) {
    const response = await fetchResultsPage(runId, page);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Lobstr results API returned ${response.status} for run ${runId}, page ${page}: ${body}`,
      );
    }

    const body = (await response.json()) as TLobstrResultsPage;
    const pageData = body.data ?? [];
    results.push(...pageData);

    const hasMore =
      body.total_pages !== undefined
        ? page < body.total_pages
        : pageData.length === LOBSTR_RESULTS_PAGE_SIZE;
    if (!hasMore || pageData.length === 0) break;
    page += 1;
  }

  return results;
};

/**
 * Human-readable identifier of a raw Lobstr result for logs, whatever the
 * platform shape (url / listing_url, annonce_id / listing_id / reference)
 */
const getRawAdLabel = (ad: TRawAd | undefined): string => {
  if (!ad) return "(unknown ad)";
  const raw = ad as Record<string, unknown>;
  const id = raw.annonce_id ?? raw.listing_id ?? raw.reference ?? "?";
  const url = raw.url ?? raw.listing_url ?? "";
  return `${id} ${url}`.trim();
};

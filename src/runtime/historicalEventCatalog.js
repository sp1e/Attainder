// Loads the approved event catalog on demand so Vite can code-split the JSON.
// The memo holds the promise; a failed import clears it so a later call retries.
export const createCatalogLoader = (importer) => {
  let memo = null;
  return () => {
    if (!memo) {
      memo = Promise.resolve()
        .then(importer)
        .then((module) => module.default ?? module)
        .catch((error) => {
          memo = null;
          throw error;
        });
    }
    return memo;
  };
};

export const loadHistoricalEventCatalog = createCatalogLoader(
  () => import("../../server/seed/historical/events/catalog.json"),
);

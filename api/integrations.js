import { fetchIntegrationCatalogue, CATALOGUE_URL } from "./_integrationCatalogue.js";

// Serves LogRocket's live integration catalogue as JSON. The client falls back to
// its bundled snapshot if this fails, so a bad response degrades rather than
// breaking guide generation.
export default async function handler(_req, res) {
  try {
    const integrations = await fetchIntegrationCatalogue();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).json({ source: CATALOGUE_URL, count: integrations.length, integrations });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}

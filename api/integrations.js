import { fetchIntegrationCatalogue, fetchLogosFor, CATALOGUE_URL } from "./_integrationCatalogue.js";
import { fetchCustomerLogos } from "./_customerLogos.js";

// Serves LogRocket's live integration catalogue as JSON. The client falls back to
// its bundled snapshot if this fails, so a bad response degrades rather than
// breaking guide generation.
//
// ?logos=Datadog,Qualtrics returns those tools' logos as data URIs instead — the
// guide is rasterised for the PDF, so embedding avoids a remote-image race.
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    // ?customers=Tecovas,ThredUp returns those customers' logos as data URIs.
    const customers = url.searchParams.get("customers");
    if (customers) {
      const map = await fetchCustomerLogos(customers.split(",").map(s => s.trim()));
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.status(200).json({ logos: map });
      return;
    }
    const logos = url.searchParams.get("logos");
    if (logos) {
      const map = await fetchLogosFor(logos.split(",").map(s => s.trim()));
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.status(200).json({ logos: map });
      return;
    }
    const integrations = await fetchIntegrationCatalogue();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).json({ source: CATALOGUE_URL, count: integrations.length, integrations });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}

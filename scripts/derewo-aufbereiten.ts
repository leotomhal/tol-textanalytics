/**
 * Einmalig auszuführendes Skript: wandelt eine lokale DeReWo-Rohdatei in
 * `src/data/derewo-top20k.json` um.
 *
 * WICHTIGE ABWEICHUNG VOM KONZEPT (3.5): Die verfügbare Rohdatei ist die
 * DeReWo-**Wortformenliste** (Wortform + Grammatik-Tag je Zeile, z. B.
 * `Kreisregierung,sg`), nicht die frequenzsortierte Grundformenliste
 * (`derewo-v-ww-bll-…`) mit Häufigkeitsklassen, die das Konzept
 * ursprünglich vorsieht. Eine Rangfolge ("Top 5.000/20.000 nach
 * Häufigkeit") lässt sich aus dieser Datei nicht bilden.
 *
 * Umsetzung als reines Bekanntheits-Wörterbuch (Entscheidung mit dem
 * Auftraggeber abgestimmt): Jede Wortform aus der Liste gilt als
 * "bekannt". Da die Liste bereits sämtliche Flexionsformen enthält, ist
 * kein Stemming nötig — Abgleich erfolgt per exaktem Wortformvergleich
 * (Kleinschreibung). Der Dateiname bleibt `derewo-top20k.json`, um die
 * Architektur aus Konzept 2.1 nicht zu verändern; Inhalt und Herkunft sind
 * im `hinweis`-Feld der JSON sowie hier dokumentiert.
 *
 * Aufruf: `npx tsx scripts/derewo-aufbereiten.ts [Pfad-zur-Wortformliste]`
 * Standardpfad: `scripts/derewo-quelle/wortformliste.csv` (nicht im Git,
 * siehe .gitignore — Lizenz erlaubt keine Weitergabe der Rohdatei).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const STANDARD_QUELLE = resolve(HIER, "derewo-quelle/wortformliste.csv");
const ZIEL = resolve(HIER, "../src/data/derewo-top20k.json");

function main(): void {
	const quelle = process.argv[2] ? resolve(process.argv[2]) : STANDARD_QUELLE;

	let roh: string;
	try {
		roh = readFileSync(quelle, "utf-8");
	} catch {
		console.error(`Quelldatei nicht gefunden: ${quelle}`);
		console.error("Aufruf: npx tsx scripts/derewo-aufbereiten.ts [Pfad-zur-Wortformliste]");
		process.exitCode = 1;
		return;
	}

	const woerter = new Set<string>();
	for (const zeile of roh.split("\n")) {
		if (!zeile) continue;
		const trennstelle = zeile.lastIndexOf(",");
		if (trennstelle === -1) continue;
		const wortform = zeile.slice(0, trennstelle).trim();
		if (wortform.length === 0) continue;
		woerter.add(wortform.toLowerCase());
	}

	const ausgabe = {
		hinweis:
			"DeReWo-Wortformenliste (IDS Mannheim), ohne Häufigkeitsrang — reines Bekanntheits-Wörterbuch. Siehe derewo-LICENSE.txt und den Kommentarkopf von scripts/derewo-aufbereiten.ts.",
		anzahlWoerter: woerter.size,
		woerter: Array.from(woerter).sort(),
	};

	writeFileSync(ZIEL, JSON.stringify(ausgabe));
	console.log(`Geschrieben: ${ZIEL} (${woerter.size} Wortformen)`);
}

main();

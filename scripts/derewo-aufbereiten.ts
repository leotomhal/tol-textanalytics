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
 * FORMAT: 817.938 Wortformen als rohes JSON-Array wären ~13 MB (viel davon
 * Anführungszeichen/Kommas). Stattdessen: newline-getrennter Text, gzip,
 * base64 — reduziert die Datei auf ~3 MB. Wird beim Laden (wortschatz.ts)
 * über die Web-Standard-API `DecompressionStream` wieder entpackt, die auch
 * in einer Obsidian-Mobile-Webview verfügbar ist (anders als Node-`zlib`,
 * das Mobile ausschließen würde — die Entscheidung "Mobile ja/nein" ist
 * laut Konzept 8.2 noch offen und sollte hier nicht stillschweigend
 * vorweggenommen werden). Deshalb lädt wortschatz.ts die Liste asynchron.
 *
 * Aufruf: `npx tsx scripts/derewo-aufbereiten.ts [Pfad-zur-Wortformliste]`
 * Standardpfad: `scripts/derewo-quelle/wortformliste.csv` (nicht im Git,
 * siehe .gitignore — Lizenz erlaubt keine Weitergabe der Rohdatei).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

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

	const sortiert = Array.from(woerter).sort();
	const komprimiert = gzipSync(sortiert.join("\n"), { level: 9 }).toString("base64");

	const ausgabe = {
		hinweis:
			"DeReWo-Wortformenliste (IDS Mannheim), ohne Häufigkeitsrang — reines Bekanntheits-Wörterbuch. Siehe derewo-LICENSE.txt und den Kommentarkopf von scripts/derewo-aufbereiten.ts.",
		anzahlWoerter: sortiert.length,
		// gzip(newline-getrennte, sortierte Wortliste), base64-kodiert.
		komprimiert,
	};

	writeFileSync(ZIEL, JSON.stringify(ausgabe));
	console.log(
		`Geschrieben: ${ZIEL} (${sortiert.length} Wortformen, ${(komprimiert.length / 1024 / 1024).toFixed(2)} MB base64)`
	);
}

main();

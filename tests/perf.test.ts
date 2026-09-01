import { describe, expect, it } from "vitest";
import { analysiere } from "../src/analyse/index";
import { ladeDerewoFrequenzquelle } from "../src/analyse/wortschatz";

/**
 * Performance-Regressionstest (Konzept 8.1: Zielwert < 50 ms für 5.000
 * Wörter). Gemessen auf dieser Maschine liegt der Median bei ~15-25 ms
 * (siehe M8-Commit); die Schwelle hier ist großzügiger (200 ms) und dient
 * als Regressionswächter gegen künftige Verlangsamungen, nicht als exakte
 * Zielwert-Prüfung — CI-Maschinen sind langsamer und variabler als eine
 * feste Zahl vertragen würde. Ein einzelner Lauf ohne Aufwärmen, damit der
 * Test auch einen kalten Start abdeckt.
 */
function generiereText(zielWoerter: number): string {
	const saetze = [
		"Die Universität Halle hat heute eine neue Studie zur Landwirtschaft veröffentlicht.",
		"Die Ergebnisse zeigen, wie sich der Klimawandel auf die Ernteerträge auswirkt.",
		"Viele Landwirte in der Region beobachten diese Entwicklung schon seit Jahren.",
		"Die Forschungsgruppe hat dafür Daten aus den letzten zwanzig Jahren ausgewertet.",
		"Ein internationales Team hat mit hochauflösender Massenspektrometrie gearbeitet.",
		"Der Bericht wurde von unabhängigen Gutachtern geprüft und für gut befunden.",
		"Die Wissenschaftlerinnen und Wissenschaftler planen eine Folgestudie im nächsten Jahr.",
	];
	const teile: string[] = [];
	let woerter = 0;
	let i = 0;
	while (woerter < zielWoerter) {
		const satz = saetze[i % saetze.length];
		teile.push(satz);
		woerter += satz.split(/\s+/).length;
		i++;
	}
	return teile.join(" ");
}

describe("Performance (Konzept 8.1)", () => {
	it("analysiert ~5.000 Wörter deutlich unter 200 ms (Regressionswächter, kein exakter Zielwert)", async () => {
		const quelle = await ladeDerewoFrequenzquelle();
		const text = generiereText(5000);
		const start = performance.now();
		const ergebnis = analysiere(text, { frequenzquelle: quelle });
		const dauer = performance.now() - start;
		expect(dauer).toBeLessThan(200);
		expect(ergebnis.kennzahlen.length).toBeGreaterThan(0);
	});
});

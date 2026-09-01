import { describe, expect, it } from "vitest";
import { bewerte, liesProfilUeberschreibung } from "../src/analyse/bewertung";

describe("bewerte", () => {
	it("liefert status neutral und kein ziel, wenn kein Zielwert definiert ist", () => {
		const ergebnis = bewerte(42, undefined, "Profil Frei");
		expect(ergebnis).toEqual({ status: "neutral" });
	});

	it("liefert gruen, wenn der Wert die Obergrenze einhält", () => {
		const ergebnis = bewerte(10, 11, "Profil Pressemitteilung");
		expect(ergebnis.status).toBe("gruen");
		expect(ergebnis.ziel).toBe("≤ 11 (Profil Pressemitteilung)");
	});

	it("liefert gelb im Zwischenbereich über der Obergrenze", () => {
		const ergebnis = bewerte(13, 11, "Profil Pressemitteilung"); // 13 <= 11*1.3=14.3
		expect(ergebnis.status).toBe("gelb");
	});

	it("liefert rot deutlich über der Obergrenze", () => {
		const ergebnis = bewerte(20, 11, "Profil Pressemitteilung"); // 20 > 11*1.3=14.3
		expect(ergebnis.status).toBe("rot");
	});

	it("übernimmt eine Verschlechterung sofort, ohne Hysterese", () => {
		const ergebnis = bewerte(20, 11, "Profil", "gruen");
		expect(ergebnis.status).toBe("rot");
	});

	it("dämpft eine Verbesserung von rot zu grün, solange sie die 5%-Schwelle nicht unterschreitet", () => {
		// Genau an der Grenze (11), aber Hysterese verlangt <= 11*0.95=10.45
		const ergebnis = bewerte(11, 11, "Profil", "rot");
		expect(ergebnis.status).toBe("rot"); // bleibt beim vorherigen Status
	});

	it("übernimmt eine Verbesserung zu grün, sobald die 5%-Schwelle unterschritten ist", () => {
		const ergebnis = bewerte(10, 11, "Profil", "rot"); // 10 <= 11*0.95=10.45
		expect(ergebnis.status).toBe("gruen");
	});

	it("dämpft eine Verbesserung von rot zu gelb ebenso", () => {
		const knappUnterRotgrenze = 11 * 1.3 - 0.01; // knapp unter der Rot-Grenze, aber nicht 5% darunter
		const ergebnis = bewerte(knappUnterRotgrenze, 11, "Profil", "rot");
		expect(ergebnis.status).toBe("rot");
	});

	it("wendet keine Hysterese an, wenn kein vorheriger Status übergeben wird", () => {
		const ergebnis = bewerte(11, 11, "Profil");
		expect(ergebnis.status).toBe("gruen");
	});
});

describe("liesProfilUeberschreibung", () => {
	it("liest textanalyse-profil aus dem Frontmatter", () => {
		const text = "---\ntitle: Test\ntextanalyse-profil: pressemitteilung\n---\nFließtext.";
		expect(liesProfilUeberschreibung(text)).toBe("pressemitteilung");
	});

	it("liest den Wert unabhängig von Anführungszeichen", () => {
		const text = '---\ntextanalyse-profil: "onlinemagazin"\n---\nText.';
		expect(liesProfilUeberschreibung(text)).toBe("onlinemagazin");
	});

	it("liefert undefined ohne Frontmatter", () => {
		expect(liesProfilUeberschreibung("Nur Fließtext ohne Frontmatter.")).toBeUndefined();
	});

	it("liefert undefined, wenn das Feld im Frontmatter fehlt", () => {
		const text = "---\ntitle: Test\ntags: [a, b]\n---\nFließtext.";
		expect(liesProfilUeberschreibung(text)).toBeUndefined();
	});
});

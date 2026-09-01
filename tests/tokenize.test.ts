import { describe, expect, it } from "vitest";
import { segmentiereSaetze, tokenisiereWoerter } from "../src/analyse/tokenize";
import { maskiere } from "../src/analyse/vorbereitung";

describe("tokenisiereWoerter", () => {
	it("zählt Wörter inklusive Zahlen", () => {
		const woerter = tokenisiereWoerter("Im Jahr 2026 gab es 3 Studien.");
		expect(woerter.map((w) => w.text)).toEqual(["Im", "Jahr", "2026", "gab", "es", "3", "Studien"]);
	});

	it("liefert korrekte Offsets", () => {
		const text = "Hallo Welt";
		const [erstes, zweites] = tokenisiereWoerter(text);
		expect(text.slice(erstes.von, erstes.bis)).toBe("Hallo");
		expect(text.slice(zweites.von, zweites.bis)).toBe("Welt");
	});

	it("behandelt Umlaute und Bindestrich-Komposita als ein Wort", () => {
		const woerter = tokenisiereWoerter("Die Größe des Forschungs-Ergebnisses überrascht.");
		expect(woerter.map((w) => w.text)).toContain("Größe");
		expect(woerter.map((w) => w.text)).toContain("Forschungs-Ergebnisses");
	});
});

describe("segmentiereSaetze", () => {
	it("trennt einfache Sätze an . ? !", () => {
		const saetze = segmentiereSaetze("Das ist Satz eins. Ist das Satz zwei? Ja!");
		expect(saetze).toHaveLength(3);
		expect(saetze[0].text).toBe("Das ist Satz eins.");
		expect(saetze[1].text).toBe("Ist das Satz zwei?");
		expect(saetze[2].text).toBe("Ja!");
	});

	it("trennt nicht nach 'z. B.'", () => {
		const saetze = segmentiereSaetze("Es gibt Beispiele, z. B. dieses hier. Der nächste Satz.");
		expect(saetze).toHaveLength(2);
		expect(saetze[0].text).toContain("z. B. dieses hier.");
	});

	it("trennt nicht nach Titeln wie 'Dr.' oder 'Prof.'", () => {
		const saetze = segmentiereSaetze("Dr. Müller hat das untersucht. Das Ergebnis überrascht.");
		expect(saetze).toHaveLength(2);
		expect(saetze[0].text).toBe("Dr. Müller hat das untersucht.");
	});

	it("trennt nicht nach Ordinalzahlen wie '1. Januar'", () => {
		const saetze = segmentiereSaetze("Die Feier war am 1. Januar 2026. Alle kamen.");
		expect(saetze).toHaveLength(2);
		expect(saetze[0].text).toBe("Die Feier war am 1. Januar 2026.");
	});

	it("trennt nicht nach Initialen wie 'A. Müller'", () => {
		const saetze = segmentiereSaetze("Der Bericht stammt von A. Müller. Er ist umfangreich.");
		expect(saetze).toHaveLength(2);
		expect(saetze[0].text).toBe("Der Bericht stammt von A. Müller.");
	});

	it("behandelt weitere Abkürzungen aus der Ausnahmeliste (u. a., bzw., ggf., ca.)", () => {
		const saetze = segmentiereSaetze(
			"Es geht um Förderung, u. a. für Nachwuchsgruppen, ca. 50 Fälle, bzw. ggf. auch mehr. Zweiter Satz."
		);
		expect(saetze).toHaveLength(2);
	});

	it("erzeugt keine leeren Sätze aus rein maskierten Bereichen (Überschriften, Listen)", () => {
		const roh = "# Überschrift\n- Listenpunkt eins\n- Listenpunkt zwei\nEchter Satz hier.";
		const { maskiert } = maskiere(roh);
		const saetze = segmentiereSaetze(maskiert);
		expect(saetze).toHaveLength(1);
		expect(saetze[0].text).toBe("Echter Satz hier.");
	});

	it("liefert für jeden Satz die enthaltenen Wörter mit korrekten Dokument-Offsets", () => {
		const text = "Kurzer Satz. Ein zweiter, etwas längerer Satz mit fünf Wörtern.";
		const saetze = segmentiereSaetze(text);
		expect(saetze[0].woerter.map((w) => w.text)).toEqual(["Kurzer", "Satz"]);
		for (const satz of saetze) {
			for (const wort of satz.woerter) {
				expect(text.slice(wort.von, wort.bis)).toBe(wort.text);
			}
		}
	});

	it("liefert eine leere Liste für Text ohne Wörter (z.B. vollständig maskiert)", () => {
		const { maskiert } = maskiere("# Nur eine Überschrift\n- Nur ein Listenpunkt");
		expect(segmentiereSaetze(maskiert)).toHaveLength(0);
	});

	it("Offset-Test: text.slice(von, bis) entspricht satz.text für jeden Satz", () => {
		const text = "Erster Satz. Zweiter Satz, etwas länger! Und ein dritter?";
		const saetze = segmentiereSaetze(text);
		for (const satz of saetze) {
			expect(text.slice(satz.von, satz.bis)).toBe(satz.text);
		}
	});
});

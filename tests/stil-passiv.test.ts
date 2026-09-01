import { describe, expect, it } from "vitest";
import { findePassivkonstruktionen } from "../src/analyse/stil/passiv";
import { segmentiereSaetze } from "../src/analyse/tokenize";

describe("findePassivkonstruktionen", () => {
	it("erkennt Vorgangspassiv (werden + Partizip II)", () => {
		const text = "Das Haus wird gebaut.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePassivkonstruktionen(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].kategorie).toBe("passiv");
	});

	it("erkennt Vorgangspassiv im Präteritum", () => {
		const text = "Das Haus wurde letztes Jahr gebaut.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePassivkonstruktionen(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].kategorie).toBe("passiv");
	});

	it("verwechselt Futur (wird + Infinitiv) nicht mit Passiv", () => {
		const text = "Sie wird das Buch bezahlen.";
		const saetze = segmentiereSaetze(text);
		expect(findePassivkonstruktionen(saetze, text)).toHaveLength(0);
	});

	it("verwechselt einfaches Futur mit regelmäßigem Verb nicht mit Passiv", () => {
		const text = "Er wird morgen kommen.";
		const saetze = segmentiereSaetze(text);
		expect(findePassivkonstruktionen(saetze, text)).toHaveLength(0);
	});

	it("erkennt Zustandspassiv (sein + Partizip II, ohne 'worden') separat", () => {
		const text = "Der Brief ist geschrieben.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePassivkonstruktionen(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].kategorie).toBe("zustandspassiv");
	});

	it("erkennt Perfekt-Passiv (sein + Partizip II + worden) als echtes Passiv, nicht als Zustandspassiv", () => {
		const text = "Der Brief ist gestern geschrieben worden.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePassivkonstruktionen(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].kategorie).toBe("passiv");
		expect(befunde[0].text).toContain("worden");
	});

	it("liefert eine Fundstelle, die rohtext.slice(von,bis) entspricht", () => {
		const text = "Das Haus wird gebaut. Der Brief ist geschrieben worden.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePassivkonstruktionen(saetze, text);
		for (const b of befunde) {
			expect(text.slice(b.von, b.bis)).toBe(b.text);
		}
	});

	it("findet nichts in einem reinen Aktivsatz", () => {
		const text = "Der Handwerker baut das Haus.";
		const saetze = segmentiereSaetze(text);
		expect(findePassivkonstruktionen(saetze, text)).toHaveLength(0);
	});

	it("findet nichts, wenn der Abstand mehr als 12 Token beträgt", () => {
		const fuellwoerter = "ganz besonders wirklich außergewöhnlich unglaublich enorm sehr";
		const text = `Das Haus wird ${fuellwoerter} lange und mit viel Mühe gebaut.`;
		const saetze = segmentiereSaetze(text);
		expect(findePassivkonstruktionen(saetze, text)).toHaveLength(0);
	});

	it("ordnet nicht denselben Partizip zwei Konstruktionen zu", () => {
		const text = "Das Haus wird gebaut und das Bild wird gemalt.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePassivkonstruktionen(saetze, text);
		expect(befunde).toHaveLength(2);
	});
});

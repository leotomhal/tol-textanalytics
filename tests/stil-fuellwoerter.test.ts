import { describe, expect, it } from "vitest";
import { findeFuellwoerter } from "../src/analyse/stil/fuellwoerter";
import { segmentiereSaetze } from "../src/analyse/tokenize";

describe("findeFuellwoerter", () => {
	it("findet einzelne Füllwörter mit korrekter Fundstelle", () => {
		const text = "Das ist eigentlich ganz einfach.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeFuellwoerter(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].text).toBe("eigentlich");
		expect(text.slice(befunde[0].von, befunde[0].bis)).toBe("eigentlich");
	});

	it("findet mehrwortige Füllwort-Phrasen", () => {
		const text = "Das ist im Grunde genommen einfach.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeFuellwoerter(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].text.toLowerCase()).toBe("im grunde genommen");
	});

	it("bevorzugt die längere Phrase gegenüber der kürzeren Teilphrase", () => {
		const text = "Im Grunde genommen stimmt das.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeFuellwoerter(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].text.toLowerCase()).toBe("im grunde genommen");
	});

	it("zählt 'natürlich' als Füllwort, auch wenn ein großgeschriebenes Wort folgt", () => {
		// Regressionstest für einen Denkfehler in einer früheren Fassung:
		// "nächstes Wort großgeschrieben" als Ausschlusskriterium hätte hier
		// fälschlich nichts gefunden, weil im Deutschen jedes Substantiv
		// großgeschrieben wird.
		const text = "Das ist natürlich Unsinn.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeFuellwoerter(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].text).toBe("natürlich");
	});

	it("zählt die flektierte Form 'natürliche' nicht (kein Eintrag in der Liste, siehe Konzept-Beispiel)", () => {
		const text = "Die natürliche Auslese wirkt hier.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeFuellwoerter(saetze, text);
		expect(befunde).toHaveLength(0);
	});

	it("zählt mehrere unterschiedliche Füllwörter im selben Satz", () => {
		const text = "Das ist eigentlich quasi dasselbe.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeFuellwoerter(saetze, text);
		expect(befunde.map((b) => b.text.toLowerCase())).toEqual(["eigentlich", "quasi"]);
	});

	it("liefert keine Befunde für einen Text ohne Füllwörter", () => {
		const text = "Der Hund läuft schnell über die Wiese.";
		const saetze = segmentiereSaetze(text);
		expect(findeFuellwoerter(saetze, text)).toHaveLength(0);
	});

	it("respektiert eine benutzerdefinierte Liste", () => {
		const text = "Das ist wirklich wichtig.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeFuellwoerter(saetze, text, ["wirklich"]);
		expect(befunde).toHaveLength(1);
	});
});

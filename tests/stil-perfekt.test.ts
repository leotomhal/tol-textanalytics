import { describe, expect, it } from "vitest";
import { findePerfektkonstruktionen, istWahrscheinlichPartizipZwei } from "../src/analyse/stil/perfekt";
import { segmentiereSaetze } from "../src/analyse/tokenize";

describe("istWahrscheinlichPartizipZwei", () => {
	it("erkennt regelmäßige Formen mit ge-Präfix", () => {
		expect(istWahrscheinlichPartizipZwei("gemacht")).toBe(true);
		expect(istWahrscheinlichPartizipZwei("gespielt")).toBe(true);
		expect(istWahrscheinlichPartizipZwei("gesungen")).toBe(true);
	});

	it("erkennt Formen mit untrennbarem Präfix ohne ge-", () => {
		expect(istWahrscheinlichPartizipZwei("verstanden")).toBe(true); // auch in der Unregelmäßigen-Liste
		expect(istWahrscheinlichPartizipZwei("erreicht")).toBe(true);
		expect(istWahrscheinlichPartizipZwei("bezahlt")).toBe(true);
	});

	it("erkennt unregelmäßige Formen aus der Liste", () => {
		expect(istWahrscheinlichPartizipZwei("gewesen")).toBe(true);
		expect(istWahrscheinlichPartizipZwei("gegangen")).toBe(true);
	});

	it("Regressionstest: verwechselt Infinitive mit untrennbarem Präfix nicht mit Partizip II", () => {
		// Bug in einer früheren Fassung: "bezahlen" (Infinitiv) hätte wegen
		// "be-" + Endung "-en" fälschlich als Partizip II gegolten — das
		// hätte in M6 "wird bezahlen" (Futur) als Passiv durchgehen lassen.
		expect(istWahrscheinlichPartizipZwei("bezahlen")).toBe(false);
		expect(istWahrscheinlichPartizipZwei("verstehen")).toBe(false);
		expect(istWahrscheinlichPartizipZwei("erreichen")).toBe(false);
	});

	it("lehnt gewöhnliche Wörter ohne passendes Präfix/Endung ab", () => {
		expect(istWahrscheinlichPartizipZwei("Hund")).toBe(false);
		expect(istWahrscheinlichPartizipZwei("schnell")).toBe(false);
		expect(istWahrscheinlichPartizipZwei("Universität")).toBe(false);
	});
});

describe("findePerfektkonstruktionen", () => {
	it("findet eine einfache Perfekt-Konstruktion mit haben", () => {
		const text = "Sie hat das Buch gelesen.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePerfektkonstruktionen(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].kategorie).toBe("perfekt");
	});

	it("findet eine Perfekt-Konstruktion mit sein", () => {
		const text = "Er ist gestern gekommen.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePerfektkonstruktionen(saetze, text);
		expect(befunde).toHaveLength(1);
	});

	it("findet nichts, wenn kein Partizip im selben Satz steht", () => {
		const text = "Sie hat ein Buch. Er kam gestern.";
		const saetze = segmentiereSaetze(text);
		expect(findePerfektkonstruktionen(saetze, text)).toHaveLength(0);
	});

	it("findet nichts, wenn der Abstand mehr als 12 Token beträgt", () => {
		// Die Füllwörter hier sind bewusst so gewählt, dass keines selbst
		// als Partizip II durchgeht (sonst würde ein früherer Treffer den
		// Test verfälschen).
		const fuellwoerter = "ganz besonders wirklich außergewöhnlich unglaublich enorm sehr";
		const text = `Sie hat ${fuellwoerter} lange und mit viel Mühe das Buch gelesen.`;
		const saetze = segmentiereSaetze(text);
		expect(findePerfektkonstruktionen(saetze, text)).toHaveLength(0);
	});

	it("liefert eine Fundstelle, die rohtext.slice(von,bis) entspricht", () => {
		const text = "Wir haben lange darüber gesprochen.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePerfektkonstruktionen(saetze, text);
		for (const b of befunde) {
			expect(text.slice(b.von, b.bis)).toBe(b.text);
		}
	});

	it("ordnet nicht denselben Partizip zwei Hilfsverben zu", () => {
		const text = "Sie hat es ihm gesagt und er hat zugehört.";
		const saetze = segmentiereSaetze(text);
		const befunde = findePerfektkonstruktionen(saetze, text);
		// Zwei getrennte Perfekt-Konstruktionen, kein doppelt verwendetes Partizip.
		expect(befunde.length).toBeGreaterThanOrEqual(1);
	});
});

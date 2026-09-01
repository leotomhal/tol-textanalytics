/**
 * Verständlichkeit und Satzbau (Konzept 3.2, 3.3).
 *
 * WSTF-Formel und LIX sind Standardformeln (hohe Sicherheit), die
 * Fachwort-Korrektur hängt an der Qualität der Frequenzquelle (siehe
 * wortschatz.ts — aktuell ein Bekanntheits-Wörterbuch ohne Häufigkeitsrang,
 * daher "mittel" statt "hoch", siehe Konzept 3.2 Sicherheitsangabe).
 */

import type { Wort } from "./tokenize";
import { zaehleSilben } from "./silben";
import type { Frequenzquelle } from "./wortschatz";

function mittelwert(werte: number[]): number {
	if (werte.length === 0) return 0;
	return werte.reduce((a, b) => a + b, 0) / werte.length;
}

function anteilProzent(zaehler: number, nenner: number): number {
	if (nenner === 0) return 0;
	return (zaehler / nenner) * 100;
}

interface Wstfteilwerte {
	ms: number; // Anteil Wörter mit ≥3 Silben, %
	iw: number; // Anteil Wörter mit >6 Buchstaben, %
	es: number; // Anteil einsilbiger Wörter, %
}

function teilwerte(woerter: Wort[]): Wstfteilwerte {
	if (woerter.length === 0) return { ms: 0, iw: 0, es: 0 };
	let mehrsilbig = 0;
	let lang = 0;
	let einsilbig = 0;
	for (const w of woerter) {
		const silben = zaehleSilben(w.text);
		if (silben >= 3) mehrsilbig++;
		if (silben === 1) einsilbig++;
		if (w.text.length > 6) lang++;
	}
	return {
		ms: anteilProzent(mehrsilbig, woerter.length),
		iw: anteilProzent(lang, woerter.length),
		es: anteilProzent(einsilbig, woerter.length),
	};
}

function wstfFormel(ms: number, sl: number, iw: number, es: number): number {
	return 0.1935 * ms + 0.1672 * sl + 0.1297 * iw - 0.0327 * es - 0.875;
}

export interface WstfErgebnis {
	roh: number;
	korrigiert: number;
	ausgeschlosseneFachbegriffe: number;
}

export function berechneWSTF(
	woerter: Wort[],
	satzlaengen: number[],
	quelle: Frequenzquelle
): WstfErgebnis {
	const sl = mittelwert(satzlaengen);
	const twRoh = teilwerte(woerter);
	const roh = wstfFormel(twRoh.ms, sl, twRoh.iw, twRoh.es);

	const bekannteWoerter = woerter.filter((w) => quelle.istBekannt(w.text));
	const ausgeschlosseneFachbegriffe = woerter.length - bekannteWoerter.length;

	let korrigiert = roh;
	if (ausgeschlosseneFachbegriffe > 0 && bekannteWoerter.length > 0) {
		const twKorrigiert = teilwerte(bekannteWoerter);
		korrigiert = wstfFormel(twKorrigiert.ms, sl, twKorrigiert.iw, twKorrigiert.es);
	}

	return { roh, korrigiert, ausgeschlosseneFachbegriffe };
}

export function berechneLIX(woerter: Wort[], satzlaengen: number[]): number {
	if (satzlaengen.length === 0 || woerter.length === 0) return 0;
	const mittlereSatzlaenge = mittelwert(satzlaengen);
	const langeWoerter = woerter.filter((w) => w.text.length > 6).length;
	return mittlereSatzlaenge + anteilProzent(langeWoerter, woerter.length);
}

export interface SatzlaengenStatistik {
	median: number;
	mittelwert: number;
	max: number;
	anteilUeber20: number; // %, Konzept 3.3 / 4.2 "Lange Sätze"
	anteilUeber30: number; // %
}

export function berechneSatzlaengenStatistik(satzlaengen: number[]): SatzlaengenStatistik {
	if (satzlaengen.length === 0) {
		return { median: 0, mittelwert: 0, max: 0, anteilUeber20: 0, anteilUeber30: 0 };
	}
	const sortiert = [...satzlaengen].sort((a, b) => a - b);
	const mitte = Math.floor(sortiert.length / 2);
	const median =
		sortiert.length % 2 === 0 ? (sortiert[mitte - 1] + sortiert[mitte]) / 2 : sortiert[mitte];

	return {
		median,
		mittelwert: mittelwert(satzlaengen),
		max: Math.max(...satzlaengen),
		anteilUeber20: anteilProzent(satzlaengen.filter((l) => l > 20).length, satzlaengen.length),
		anteilUeber30: anteilProzent(satzlaengen.filter((l) => l > 30).length, satzlaengen.length),
	};
}

// Erinnerung: Schachtelungstiefe-Näherung und "Erster Satz separat" (Konzept
// 3.3) sind hier bewusst noch nicht umgesetzt — Ersteres passt inhaltlich
// besser zu den Stilmarkern (M3), Zweiteres braucht die Passiverkennung
// aus M6.

/**
 * Satz- und Worttrennung (Konzept 3.1, 7).
 *
 * Arbeitet auf bereits maskiertem Text (siehe vorbereitung.ts) — maskierte
 * Bereiche enthalten keine Satzzeichen und keine Wörter mehr und erzeugen
 * daher keine Sätze.
 */

export interface Wort {
	text: string;
	von: number;
	bis: number;
}

export interface Satz {
	text: string;
	von: number;
	bis: number;
	woerter: Wort[];
}

const WORT_REGEX = /\p{L}[\p{L}\p{N}'’-]*|\p{N}+/gu;

export function tokenisiereWoerter(text: string): Wort[] {
	const woerter: Wort[] = [];
	const re = new RegExp(WORT_REGEX);
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		woerter.push({ text: m[0], von: m.index, bis: m.index + m[0].length });
	}
	return woerter;
}

/**
 * Abkürzungen, nach denen ein folgender Punkt kein Satzende markiert
 * (Konzept 3.1). Ohne Punkt, klein geschrieben zum Vergleich.
 */
const ABKUERZUNGEN = new Set([
	"z", "b", "u", "a", "prof", "dr", "ca", "bzw", "ggf", "etc", "vgl", "sog", "nr", "st",
]);

function istWortzeichen(ch: string): boolean {
	return /[\p{L}\p{N}]/u.test(ch);
}

/**
 * Prüft, ob der Punkt/das Satzzeichen an `index` (Beginn der
 * Satzzeichenfolge) tatsächlich ein Satzende ist, oder eine der
 * Ausnahmen aus 3.1 greift (Abkürzung, Ordinalzahl, Initiale).
 */
function istSatzende(text: string, index: number): boolean {
	const zeichen = text[index];
	if (zeichen !== ".") return true; // ?, !, … sind eindeutig

	// Token unmittelbar vor dem Punkt ermitteln (kein Leerzeichen dazwischen).
	let i = index - 1;
	const tokenEnde = i + 1;
	while (i >= 0 && istWortzeichen(text[i])) i--;
	const token = text.slice(i + 1, tokenEnde);
	if (token.length === 0) return true;

	// Abkürzung wie "z.", "Dr.", "bzw." …
	if (ABKUERZUNGEN.has(token.toLowerCase())) return false;

	// Nächstes Zeichen nach dem Punkt (übersprungenes Leerzeichen).
	let j = index + 1;
	while (j < text.length && text[j] === " ") j++;
	const naechstesZeichen = text[j];
	const folgtGrossbuchstabe = !!naechstesZeichen && naechstesZeichen === naechstesZeichen.toUpperCase() && naechstesZeichen !== naechstesZeichen.toLowerCase();

	// Ordinalzahl: "1. Januar" — ein bis zwei Ziffern, gefolgt von großgeschriebenem Wort.
	if (/^\d{1,2}$/.test(token) && folgtGrossbuchstabe) return false;

	// Initiale: einzelner Großbuchstabe, gefolgt von großgeschriebenem Wort ("A. Müller").
	if (/^\p{Lu}$/u.test(token) && folgtGrossbuchstabe) return false;

	return true;
}

export function segmentiereSaetze(text: string): Satz[] {
	const alleWoerter = tokenisiereWoerter(text);
	const grenzenRegex = /[.!?…]+["'’)\]]*/gu;
	const saetze: Satz[] = [];
	let anfang = 0;
	let m: RegExpExecArray | null;
	const re = new RegExp(grenzenRegex);

	const satzHinzufuegen = (von: number, bis: number) => {
		// Leerraum am Rand abschneiden, Offsets bleiben Dokument-Offsets.
		let a = von;
		let b = bis;
		while (a < b && /\s/.test(text[a])) a++;
		while (b > a && /\s/.test(text[b - 1])) b--;
		if (a >= b) return;
		const woerter = alleWoerter.filter((w) => w.von >= a && w.bis <= b);
		if (woerter.length === 0) return; // rein maskierter/leerer Zwischenraum
		saetze.push({ text: text.slice(a, b), von: a, bis: b, woerter });
	};

	while ((m = re.exec(text))) {
		if (!istSatzende(text, m.index)) continue;
		const grenzeEnde = m.index + m[0].length;
		satzHinzufuegen(anfang, grenzeEnde);
		anfang = grenzeEnde;
		re.lastIndex = grenzeEnde;
	}
	satzHinzufuegen(anfang, text.length);

	return saetze;
}

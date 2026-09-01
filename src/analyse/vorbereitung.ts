/**
 * Maskierung und Segmentierung (Konzept 2.3).
 *
 * Maskierung ist längenerhaltend: Jedes entfernte Zeichen wird durch ein
 * Leerzeichen ersetzt (Zeilenumbrüche bleiben Zeilenumbrüche), damit sich
 * alle Zeichenoffsets späterer Befunde unverändert auf den Rohtext beziehen.
 */

export interface MaskierungsErgebnis {
	/** Gleiche Länge wie der Rohtext. Maskierte Bereiche sind Leerraum. */
	maskiert: string;
	/** Wörter in Blockquotes, in % der Gesamtwörter im Panel ausgewiesen. */
	zitatWoerter: number;
	/** Zeichenoffset im Rohtext, ab dem Schritt B (Schlussteil) maskiert hat. */
	schlussteilAbZeichen?: number;
}

const WORT_REGEX = /\p{L}[\p{L}\p{N}'’-]*/gu;

function zaehleWoerter(abschnitt: string): number {
	const treffer = abschnitt.match(WORT_REGEX);
	return treffer ? treffer.length : 0;
}

class Puffer {
	private zeichen: string[];

	constructor(text: string) {
		this.zeichen = Array.from(text);
	}

	maskieren(von: number, bis: number): void {
		for (let i = von; i < bis && i < this.zeichen.length; i++) {
			if (this.zeichen[i] !== "\n") {
				this.zeichen[i] = " ";
			}
		}
	}

	toString(): string {
		return this.zeichen.join("");
	}
}

/**
 * Maskiert einen Bereich in `puffer`, wobei der durch `praefixLaenge` und
 * `suffixLaenge` markierte innere Teilbereich unmaskiert bleibt (z.B. der
 * sichtbare Text von `[Text](url)`).
 */
function maskiereMitAusnahme(
	puffer: Puffer,
	von: number,
	bis: number,
	innenVon: number,
	innenBis: number
): void {
	if (innenVon > von) puffer.maskieren(von, innenVon);
	if (bis > innenBis) puffer.maskieren(innenBis, bis);
}

/** Schritt A: Markdown-Elemente maskieren (Tabelle in Konzept 2.3). Gibt die Zitatwortzahl zurück. */
function maskiereMarkdown(puffer: Puffer, arbeitstext: () => string): number {
	// 1. Frontmatter
	{
		const t = arbeitstext();
		const treffer = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/.exec(t);
		if (treffer && treffer.index === 0) {
			puffer.maskieren(0, treffer.index + treffer[0].length);
		}
	}

	// 2. Code-Blöcke (```...```)
	{
		const t = arbeitstext();
		const re = /```[\s\S]*?```/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}

	// 3. Inline-Code (`...`)
	{
		const t = arbeitstext();
		const re = /`[^`\n]+`/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}

	// 4. Obsidian-Kommentare %%…%%
	{
		const t = arbeitstext();
		const re = /%%[\s\S]*?%%/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}

	// 5. Bilder ![[…]] und ![](…) — vor Wikilinks/Links, sonst partiell erwischt
	{
		const t = arbeitstext();
		const re = /!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)\n]*\)/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}

	// 6. Wikilinks [[Ziel|Anzeige]] oder [[Ziel]] — Syntax und Ziel maskieren,
	//    Anzeigetext (bzw. Ziel ohne Alias) bleibt.
	{
		const t = arbeitstext();
		const re = /\[\[([^\]|\n]+)(\|([^\]\n]+))?\]\]/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			const von = m.index;
			const bis = m.index + m[0].length;
			if (m[3] !== undefined) {
				// Alias vorhanden: Anzeigetext (Gruppe 3) bleibt sichtbar.
				const anzeigeVon = m.index + m[0].indexOf(m[3], m[1].length);
				const anzeigeBis = anzeigeVon + m[3].length;
				maskiereMitAusnahme(puffer, von, bis, anzeigeVon, anzeigeBis);
			} else {
				// Kein Alias: Ziel selbst ist der Anzeigetext.
				const zielVon = m.index + 2;
				const zielBis = zielVon + m[1].length;
				maskiereMitAusnahme(puffer, von, bis, zielVon, zielBis);
			}
		}
	}

	// 7. Links [Text](url) — Klammern und URL maskieren, Linktext bleibt.
	{
		const t = arbeitstext();
		const re = /\[([^\]\n]*)\]\(([^)\n]*)\)/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			const von = m.index;
			const bis = m.index + m[0].length;
			const textVon = m.index + 1;
			const textBis = textVon + m[1].length;
			maskiereMitAusnahme(puffer, von, bis, textVon, textBis);
		}
	}

	// 8. Fußnoten: Definitionszeile-Präfix "[^1]: " maskieren (Text bleibt),
	//    alle übrigen Fußnotenmarker "[^1]" komplett maskieren.
	{
		const t = arbeitstext();
		const reDef = /^\[\^[^\]\n]+\]:[ \t]?/gm;
		let m: RegExpExecArray | null;
		while ((m = reDef.exec(t))) {
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}
	{
		const t = arbeitstext();
		const re = /\[\^[^\]\n]+\]/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}

	// 9. Überschriften — komplett maskieren, inklusive Text.
	{
		const t = arbeitstext();
		const re = /^ {0,3}#{1,6}[ \t].*$/gm;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}

	// 10. Listenzeilen (-, *, +, "1.", Aufgabenlisten) — komplett maskieren.
	{
		const t = arbeitstext();
		const re = /^ {0,3}(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?.*$/gm;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}

	// 11. Tabellenzeilen — komplett maskieren.
	{
		const t = arbeitstext();
		const re = /^ {0,3}\|.*\|[ \t]*$|^ {0,3}[:\-| \t]*\|[:\-| \t]*$/gm;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}

	// 12. Blockquotes — komplett maskieren, Wortzahl separat zählen.
	let zitatWoerter = 0;
	{
		const t = arbeitstext();
		const re = /^ {0,3}>[ \t]?.*$/gm;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			zitatWoerter += zaehleWoerter(m[0]);
			puffer.maskieren(m.index, m.index + m[0].length);
		}
	}

	// 13. Tags #thema — nach Überschriften, damit "# Überschrift" nicht
	//     nochmal als Tag verarbeitet wird (dort steht ohnehin schon Leerraum).
	{
		const t = arbeitstext();
		const re = /(^|\s)#[^\s#[\]]+/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t))) {
			const tagVon = m.index + m[1].length;
			puffer.maskieren(tagVon, m.index + m[0].length);
		}
	}

	// 14. Inline-Auszeichnung — nur Syntaxzeichen maskieren, Text bleibt.
	//     Reihenfolge: doppelte Marker vor einfachen.
	const inlineMarker: [RegExp, number][] = [
		[/\*\*(.+?)\*\*/g, 2],
		[/__(.+?)__/g, 2],
		[/==(.+?)==/g, 2],
		[/~~(.+?)~~/g, 2],
		[/(?<![*\w])\*([^*\n]+?)\*(?!\*)/g, 1],
		[/(?<![_\w])_([^_\n]+?)_(?!_)/g, 1],
	];
	for (const [re, markerLaenge] of inlineMarker) {
		const t = arbeitstext();
		let m: RegExpExecArray | null;
		re.lastIndex = 0;
		while ((m = re.exec(t))) {
			const von = m.index;
			const bis = m.index + m[0].length;
			const innenVon = von + markerLaenge;
			const innenBis = bis - markerLaenge;
			maskiereMitAusnahme(puffer, von, bis, innenVon, innenBis);
		}
	}

	return zitatWoerter;
}

/**
 * Schritt B: Ab der ersten Zeile, die mit einem der `auslöser`-Strings
 * beginnt (Groß-/Kleinschreibung ignoriert), wird der Rest der Notiz
 * maskiert. Die Auslöserliste kommt aus den Settings (ab M7); ohne
 * Konfiguration greift Schritt B nicht.
 */
function maskiereSchlussteil(
	puffer: Puffer,
	rohtext: string,
	ausloeser: string[]
): number | undefined {
	if (ausloeser.length === 0) return undefined;
	const normalisiert = ausloeser
		.map((a) => a.trim().toLowerCase())
		.filter((a) => a.length > 0);
	if (normalisiert.length === 0) return undefined;

	// Zeilenweise ohne Regex-Loop (vermeidet Nullbreite-Match-Fallstricke bei
	// Leerzeilen — `exec` erhöht `lastIndex` dabei nicht selbstständig).
	let zeilenAnfang = 0;
	while (zeilenAnfang <= rohtext.length) {
		let zeilenEnde = rohtext.indexOf("\n", zeilenAnfang);
		if (zeilenEnde === -1) zeilenEnde = rohtext.length;
		const zeile = rohtext.slice(zeilenAnfang, zeilenEnde).trim().toLowerCase();
		if (zeile.length > 0 && normalisiert.some((a) => zeile.startsWith(a))) {
			puffer.maskieren(zeilenAnfang, rohtext.length);
			return zeilenAnfang;
		}
		zeilenAnfang = zeilenEnde + 1;
	}
	return undefined;
}

export function maskiere(rohtext: string, schlussteilAusloeser: string[] = []): MaskierungsErgebnis {
	const puffer = new Puffer(rohtext);
	const zitatWoerter = maskiereMarkdown(puffer, () => puffer.toString());
	const schlussteilAbZeichen = maskiereSchlussteil(puffer, rohtext, schlussteilAusloeser);

	return {
		maskiert: puffer.toString(),
		zitatWoerter,
		schlussteilAbZeichen,
	};
}

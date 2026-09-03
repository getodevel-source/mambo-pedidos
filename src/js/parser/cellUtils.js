// cellUtils.js — helpers puros de celda/imagen/geometría extraídos de
// pdfParser.js (PIL6, repo-improvement-sprint). Cero deuda de flujo: se
// vuelven a asignar a PdfParser con Object.assign (mismo patrón que
// pdfParserClassifier.js); `this` se resuelve en runtime contra PdfParser.
// GOLDEN: la extracción de los 13 PDFs debe dar hash idéntico antes/después.
const CellUtils = {
cleanImageBackground(ctx, width, height) {
		try {
			if (!ctx || !width || !height) return;
			const imgData = ctx.getImageData(0, 0, width, height);
			const data = imgData.data;

			const cornerIdxs = [
				0,
				(width - 1) * 4,
				(height - 1) * width * 4,
				((height - 1) * width + width - 1) * 4,
			];

			let sumR = 0,
				sumG = 0,
				sumB = 0,
				count = 0;
			for (const idx of cornerIdxs) {
				if (data[idx + 3] > 0) {
					sumR += data[idx];
					sumG += data[idx + 1];
					sumB += data[idx + 2];
					count++;
				}
			}

			if (count === 0) return;
			const bgR = sumR / count;
			const bgG = sumG / count;
			const bgB = sumB / count;

			if (bgR < 180 || bgG < 180 || bgB < 180) return;

			const visited = new Uint8Array(width * height);
			const queue = [];

			for (let x = 0; x < width; x++) {
				queue.push(x, 0);
				queue.push(x, height - 1);
			}
			for (let y = 1; y < height - 1; y++) {
				queue.push(0, y);
				queue.push(width - 1, y);
			}

			const isBgColor = (pxR, pxG, pxB) => {
				const dist =
					Math.abs(pxR - bgR) + Math.abs(pxG - bgG) + Math.abs(pxB - bgB);
				return dist < 20;
			};

			let head = 0;
			while (head < queue.length) {
				const cx = queue[head++];
				const cy = queue[head++];
				const idx = cy * width + cx;

				if (visited[idx]) continue;
				visited[idx] = 1;

				const pIdx = idx * 4;
				const r = data[pIdx];
				const g = data[pIdx + 1];
				const b = data[pIdx + 2];

				if (isBgColor(r, g, b)) {
					data[pIdx + 3] = 0;

					if (cx > 0) queue.push(cx - 1, cy);
					if (cx < width - 1) queue.push(cx + 1, cy);
					if (cy > 0) queue.push(cx, cy - 1);
					if (cy < height - 1) queue.push(cx, cy + 1);
				}
			}

			ctx.putImageData(imgData, 0, 0);
		} catch (e) {
			console.warn("No se pudo limpiar fondo de imagen:", e);
		}
	},
extractDominantColor(ctx, width, height) {
		try {
			const imgData = ctx.getImageData(0, 0, width, height);
			const data = imgData.data;
			const buckets = {};
			let totalVisible = 0;

			for (let i = 0; i < data.length; i += 4) {
				const a = data[i + 3];
				if (a < 30) continue; // transparente (fondo removido)

				const r = data[i],
					g = data[i + 1],
					b = data[i + 2];

				// Ignorar píxeles casi blancos (fondo residual)
				if (r > 235 && g > 235 && b > 235) continue;

				const name = this.classifyColorName(r, g, b);
				if (!buckets[name])
					buckets[name] = { count: 0, rSum: 0, gSum: 0, bSum: 0 };
				buckets[name].count++;
				buckets[name].rSum += r;
				buckets[name].gSum += g;
				buckets[name].bSum += b;
				totalVisible++;
			}

			if (totalVisible < 5)
				return { name: "UNKNOWN", r: 128, g: 128, b: 128, confidence: 0 };

			let best = null;
			for (const [name, b] of Object.entries(buckets)) {
				if (!best || b.count > best.count) {
					best = {
						name,
						count: b.count,
						r: Math.round(b.rSum / b.count),
						g: Math.round(b.gSum / b.count),
						b: Math.round(b.bSum / b.count),
					};
				}
			}

			return {
				...best,
				confidence: Math.round((best.count / totalVisible) * 100),
			};
		} catch {
			return { name: "UNKNOWN", r: 128, g: 128, b: 128, confidence: 0 };
		}
	},
extractInteriorColor(ctx, width, height) {
		try {
			if (!ctx || !width || !height) return null;
			if (
				typeof ImageTextGates === "undefined" ||
				!ImageTextGates.sampleInteriorColor
			)
				return null;
			const imgData = ctx.getImageData(0, 0, width, height);
			return ImageTextGates.sampleInteriorColor(
				imgData.data,
				width,
				height,
				0.6,
			);
		} catch {
			return null;
		}
	},
classifyColorName(r, g, b) {
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const saturation = max > 0 ? (max - min) / max : 0;
		const brightness = max / 255;

		// Acromáticos
		if (brightness < 0.22) return "BLACK";
		if (saturation < 0.12 && brightness > 0.85) return "WHITE";
		if (saturation < 0.12) return brightness > 0.55 ? "SILVER" : "GRAY";

		// Cromáticos
		if (r > g + 40 && r > b + 40) {
			if (g > 100 && b < 80) return "GOLD";
			if (g < 80) return "RED";
			return "ORANGE";
		}
		if (g > r + 25 && g > b + 25) return "GREEN";
		if (b > r + 30 && b > g + 15) {
			if (r > 80 && g < 100) return "PURPLE";
			if (g > 150) return "CYAN";
			return "BLUE";
		}
		if (r > 140 && g < 130 && b > 120) return "PINK";
		if (r > 120 && g > 100 && b < 80) return "GOLD";

		return "MULTICOLOR";
	},
isValidImageDataUrl(value) {
		if (typeof value !== "string") return false;
		return /^data:image\/(?:png|jpe?g|webp|gif);(?:base64,[a-z0-9+/=\s]+|[^\s]+)$/i.test(
			value.trim(),
		);
	},
detectTableHeaders(rawElements, priceColX) {
		const candidates = [];
		// Agrupar por fila Y (tolerancia 6px, como el resto del engine)
		const rows = new Map();
		for (const el of rawElements) {
			if (el.x >= priceColX - 10) continue; // zona de precios
			if (!this.HEADER_TOKEN_RE.test(el.text.trim())) continue;
			const key = Math.round(el.y / 6);
			if (!rows.has(key)) rows.set(key, []);
			rows.get(key).push(el);
		}
		for (const els of rows.values()) {
			if (els.length < 2) continue;
			const xs = els.map((e) => e.x).sort((a, b) => a - b);
			if (xs[xs.length - 1] - xs[0] < 40) continue; // sin dispersión horizontal
			const columns = [];
			for (const el of els) {
				for (const [role, re] of Object.entries(this.HEADER_ROLE_RE)) {
					if (
						re.test(el.text.trim()) &&
						!columns.some((c) => c.role === role)
					) {
						columns.push({ role, x: el.x });
						break;
					}
				}
			}
			if (columns.length < 2) continue;
			const hasProductRole = columns.some(
				(c) => c.role === "model" || c.role === "color" || c.role === "switch",
			);
			if (!hasProductRole) continue;
			columns.sort((a, b) => a.x - b.x);
			candidates.push({ y: els[0].y, columns });
		}
		return candidates;
	},
findHeaderAbove(headers, y) {
		let best = null;
		for (const h of headers) {
			if (h.y < y && (!best || h.y > best.y)) best = h;
		}
		return best;
	},
classifyByHeader(header, x) {
		const cols = header.columns;
		if (x >= cols[cols.length - 1].x + 60) return "skip";
		for (let i = 0; i < cols.length; i++) {
			const left = i === 0 ? -Infinity : (cols[i - 1].x + cols[i].x) / 2;
			const right =
				i === cols.length - 1 ? Infinity : (cols[i].x + cols[i + 1].x) / 2;
			if (x >= left && x < right) {
				if (cols[i].role === "model") return "model";
				if (cols[i].role === "color") return "color";
				if (cols[i].role === "switch") return "switch";
				return "skip"; // image / cny / usd / price
			}
		}
		return null;
	},
detectModelNameRows(rawElements, isPageNoise) {
		const rows = [];
		const band = {};
		const headerLabels = [];
		// Colors that look code-like but are NOT model names (KZ color rows).
		const COLOR_TOK =
			/^(transparent|black|white|silver|grey|gray|blue|red|pink|green|purple|gold|cyan|orange|brown|coffee|cream|teal|navy|black\/cyan|silver\/black|grey\/cyan|black\/white)$/i;
		for (const el of rawElements) {
			if (isPageNoise && isPageNoise(el.text)) continue;
			// Structural labels ("Model" / "Name") live far left; "型号" is filtered as
			// CJK noise but the English pair survives and marks the header band.
			if (el.x < 120 && /^(Model|Name|Model Name)$/.test(el.text.trim())) {
				headerLabels.push(el.y);
			}
			if (/^[¥￥$]/.test(el.text)) continue;
			if (this.extractUsdPrice(el.text) !== null) continue;
			if (el.x < 120) continue; // model names are in the column area
			if (COLOR_TOK.test(el.text.trim())) continue; // color row, not model row
			const key = Math.round(el.y / 8);
			(band[key] = band[key] || []).push({ x: el.x, y: el.y, text: el.text });
		}
		for (const key of Object.keys(band)) {
			const toks = band[key];
			if (toks.length < 2) continue;
			toks.sort((a, b) => a.x - b.x);
			// Model-name tokens: alphanumeric (allow mixed case: Libra, Sonata/),
			// reject long pure-word descriptors (Version, Switches, Resolution) and
			// short standalone suffixes (Hot, Pro, X) that follow a real token.
			const codeLike = toks.filter((t) => {
				const s = t.text.trim();
				if (!/^[A-Za-z0-9][A-Za-z0-9/-]{1,}$/.test(s)) return false;
				if (/^[A-Za-z]{6,}$/.test(s)) return false;
				// Price-row labels that repeat per column (KZ "Without mic" / "With mic")
				// are NOT model names.
				if (
					/^(mic|without|with|price|rmb|usd|version|edition|color|model)$/i.test(
						s,
					)
				)
					return false;
				return true;
			});
			if (codeLike.length < 2) continue;
			// Cluster tokens closer than 60px (e.g. "ZVX" + "PRO" in one column), then
			// require >= 2 clusters separated by >= 60px (multiple matrix columns).
			const clusters = [];
			for (const t of codeLike) {
				const last = clusters[clusters.length - 1];
				if (last && t.x - last.tokens[last.tokens.length - 1].x < 60) {
					last.tokens.push(t);
				} else {
					clusters.push({ x: t.x, tokens: [t] });
				}
			}
			if (clusters.length < 2) continue;
			let ok = true;
			for (let i = 1; i < clusters.length; i++) {
				if (clusters[i].x - clusters[i - 1].x < 60) {
					ok = false;
					break;
				}
			}
			if (!ok) continue;
			// The row must sit right under a "Model Name" header label.
			const rowY = toks[0].y;
			if (!headerLabels.some((hy) => Math.abs(hy - rowY) <= 45)) continue;
			// PIL13 v4: el join + completion SOLO corren en filas-matriz LIMPIAS
			// (stubs cortos, sin slashes interiores, sin badges/mic). Las filas
			// con sopa (p4-y308, listas de colores, multis) quedan en v0 exacto.
			const COLOR_STUB_RE =
				/^(transparent|black|white|silver|grey|gray|blue|red|pink|green|purple|gold|cyan|orange|brown|coffee|cream|teal|navy|crystal|clear|blk|wukong)$/i;
			// Descriptores que aparecen como "columna" en páginas-sopa pero nunca
			// son modelo (trazable a p5-y323/p15: Bass/High/Cable/... sueltos).
			const DESCRIPTOR_STUB_RE =
				/^(bass|high|cable|version|balanced|switch|switches|mic|mics)$/i;
			const baseIsMatrixStub = (b) => {
				const bs = String(b || "");
				const w = bs.split(/\s+/).filter(Boolean);
				if (w.length === 0 || w.length > 2) return false;
				if (w.length === 1 && b.length < 3) return false;
				// Marca como stub ("KZ Pro") o descriptor suelto ("Bass", "High"):
				// nunca es columna-modelo.
				if (
					w.some(
						(x) =>
							DESCRIPTOR_STUB_RE.test(x) ||
							(typeof this.isBrandWord === "function" && this.isBrandWord(x)),
					)
				)
					return false;
				// Listas de colores (Black/Silver/Green, BLK//Golden) y colores
				// sueltos (Transparent, Crystal) no son columnas-modelo.
				if (/\/\//.test(bs)) return false;
				if (COLOR_STUB_RE.test(bs.trim())) return false;
				if (
					/\//.test(bs) &&
					bs
						.split("/")
						.filter(Boolean)
						.some((seg) => COLOR_STUB_RE.test(seg.trim()))
				)
					return false;
				if (/[^/]\/[^/]/.test(bs) && !/\/$/.test(bs)) return false;
				return !this.isDirtyColumnText(b);
			};
			const rowClean = clusters.every((c) =>
				baseIsMatrixStub(c.tokens.map((tok) => tok.text).join(" ")),
			);
			// PIL13: qualifier de matriz (nearest-column + paréntesis en crudo +
			// sin badges/dimensión mic). Ver matrixQualifierBelow.
			const qual = rowClean
				? this.matrixQualifierBelow(band, Number(key), clusters, rawElements)
				: clusters.map(() => "");
			const tokens = clusters.map((c, i) => {
				const base = c.tokens.map((t) => t.text).join(" ");
				return {
					x: c.tokens[0].x,
					base,
					text: base + (qual[i] ? " " + qual[i] : ""),
					dirty: this.isDirtyColumnText(base),
				};
			});
			rows.push({ y: rowY, tokens, clean: rowClean });
		}
		return rows.sort((a, b) => a.y - b.y);
	},
// PIL13: una columna-basura se delata sola (badge promo o pareja mic en su
// texto base). Se usa para el qualifier (v3) y para no instalar su identidad
// en filas (SLICE 3): nunca reemplaza el texto propio de la fila.
isDirtyColumnText(s) {
	const txt = String(s || "");
	if (/\b(hot|new|sales?|promo|offers?|discounts?|clearance)\b/i.test(txt)) return true;
	return /\bmics?\b/i.test(txt) && /\b(with|without)\b/i.test(txt);
},
// PIL13: qualifiers de matriz en las bandas de abajo, asignados a la
// columna MÁS CERCANA, y solo si hay un paréntesis cerca en el TEXTO CRUDO.
// Excluye badges promo, la dimensión mic (with/without mic) y duplicados.
// Devuelve un qualifier por columna ("" si no hay). Puro y testeable.
matrixQualifierBelow(band, key, clusters, rawElements) {
	const BADGE_RE = /^(hot|new|sales?|promo|offers?|discounts?|clearance)$/i;
	const DIRTY_WORD_RE = /\b(hot|new|sales?|promo|offers?|discounts?|clearance)\b/i;
	// Pareja mic + with/without en el MISMO texto (orden indistinto): dimensión
	// mic, no qualifier. Se evalúa sobre columna y qualifier unidos.
	const hasMicPair = (s) => /\bmics?\b/i.test(s) && /\b(with|without)\b/i.test(s);
	const buckets = (clusters || []).map(() => []);
	for (const dk of [key + 1, key + 2, key + 3]) {
		const toks = ((band && band[String(dk)]) || []).slice().sort((a, b) => a.x - b.x);
		for (const tok of toks) {
			const s = String(tok.text || "").trim();
			if (s.length < 2) continue;
			let bi = -1, bd = Infinity;
			(clusters || []).forEach((c, idx) => {
				const d = Math.abs((Number(tok.x) || 0) - (Number(c.x) || 0));
				if (d < bd) { bd = d; bi = idx; }
			});
			if (bi < 0) continue;
			buckets[bi].push({ x: Number(tok.x) || 0, s });
		}
	}
	const parenNear = (colX) =>
		(Array.isArray(rawElements) ? rawElements : []).some((el) => {
			const txt = String((el && (el.text != null ? el.text : el.str)) || "");
			if (!/[()（）[\]{}]/.test(txt)) return false;
			const ey = Number(el.y) || 0;
			return Math.abs(ey - (Number(key) + 2) * 8) <= 24 && Math.abs((Number(el.x) || 0) - colX) <= 100;
		});
	return (clusters || []).map((c, i) => {
		const colText = String((c.tokens || []).map((t) => t.text).join(" "));
		// La columna-basura se delata sola: si ella o su qualifier unido traen
		// badge o pareja mic, no se une nada (default seguro).
		if (DIRTY_WORD_RE.test(colText) || hasMicPair(colText)) return "";
		const colWords = new Set(
			colText.toLowerCase().split(/\s+/).filter(Boolean),
		);
		const mine = (buckets[i] || []).sort((a, b) => a.x - b.x);
		if (!parenNear(Number(c.x) || 0)) return "";
		const words = [];
		for (const w of mine) {
			const bare = w.s.replace(/^[()（）[\]{}]+|[()（）[\]{}]+$/g, "");
			if (!bare || bare.length < 2) continue;
			// El qualifier es un descriptor de versión en letras (Balanced,
			// High Resolution): códigos (ZS10) o CJK (均衡版) no califican.
			if (/\d/.test(bare)) continue;
			if (/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uFF00-\uFFEF]/.test(bare)) continue;
			const bl = bare.toLowerCase();
			if (BADGE_RE.test(bl)) continue;
			if (colWords.has(bl)) continue;
			colWords.add(bl);
			words.push(bare);
		}
		const joined = words.join(" ");
		if (!joined) return "";
		if (DIRTY_WORD_RE.test(joined) || hasMicPair(joined)) return "";
		return joined;
	});
	},

	findModelNameRowAbove(modelNameRows, anchorY) {
		let best = null;
		for (const r of modelNameRows) {
			if (r.y >= anchorY - 5) continue;
			if (anchorY - r.y > 260) continue;
			if (!best || anchorY - r.y < anchorY - best.y) best = r;
		}
		return best;
	},
findModelNameTokenAt(mnr, anchorX) {
		let best = null;
		for (const t of mnr.tokens) {
			if (!best || Math.abs(t.x - anchorX) < Math.abs(best.x - anchorX))
				best = t;
		}
		return best || null;
	},
findBlockCodeAbove(rawElements, isPageNoise, y, xMin, xMax, maxDist = 250) {
		const codeLike = /(?:^|[\s-])(?!paw\d)([A-Za-z]{1,6}\d{1,4}[\w+]*)/i;
		const headerRe =
			/^(model|color|price|image|picture|spec|remark|moq|fob|cny|rmb|usd)\b/i;
		const candidates = rawElements
			.filter((el) => el.y < y && el.y >= y - maxDist && !isPageNoise(el.text))
			.filter((el) => el.x >= xMin && el.x <= xMax)
			.filter((el) => codeLike.test(el.text) && !headerRe.test(el.text.trim()))
			.sort((a, b) => b.y - a.y);
		return candidates.length ? candidates[0].text.trim() : null;
	},
isSpecOnlyModel(rawModelo) {
		const text = String(rawModelo || "").trim();
		if (!text) return false;
		if (/(?:^|[\s-])(?!paw\d)([A-Za-z]{1,6}\d{1,4}[\w+]*)/i.test(text))
			return false;
		const tokens = text
			.toLowerCase()
			.split(/[\s\-+/]+/)
			.filter(Boolean);
		if (!tokens.length) return false;
		if (/^paw\d[\w]*$/i.test(tokens.join(""))) return true;
		const SPEC_TOKEN_RE =
			/^(tri|mode|charging|charge|dock|wireless|wired|bluetooth|mechanical|magnetic|carbon|fiber|rapid|trigger|hall|effect|ice|axis|switch|keycap|engraving|gradient|screen|display|paw\d[\w]*|with|and|total|bottoming|\d+(\.\d+)?(k|khz|ghz|mhz|hz|dpi|g|mm|%|mah|mv|db))$/i;
		return tokens.every((t) => SPEC_TOKEN_RE.test(t));
	},
moveTrailingTypeKeyword(modelo, variante) {
		const TYPE_TAIL_RE =
			/\b(mouse|keyboard|controller|headset|earphone|earbuds|numpad|mousepad|webcam|camera|microphone|switch|chair|desk|hub|adapter|cable|stand|gamepad|dock|receiver)$/i;
		const STATUS_TAIL_RE = /^(released|new|upcoming)$/i;
		const DESCRIPTOR_ONLY_RE =
			/^(combo|wired|wireless|bluetooth|mechanical|gaming|optical|rgb|silent|magnetic|hall|usb|2\.4g|pro|ultra|max)$/i;
		let m = String(modelo || "").trim();
		let v = String(variante || "").trim();
		let guard = 0;
		while (guard++ < 5) {
			const words = m.split(/\s+/);
			if (words.length < 2) break;
			const last = words[words.length - 1];
			const isTypeTail = TYPE_TAIL_RE.test(last);
			const isStatusTail = STATUS_TAIL_RE.test(last);
			if (isTypeTail || isStatusTail) {
				const remaining = words.slice(0, -1);
				// No dejes un descriptor puro como modelo ('Combo Mouse' → no 'Combo').
				if (remaining.length === 1 && DESCRIPTOR_ONLY_RE.test(remaining[0]))
					break;
				m = remaining.join(" ");
				v = (v + " " + last).replace(/\s+/g, " ").trim();
				continue;
			}
			if (/^combo$/i.test(words[0])) {
				m = words.slice(1).join(" ");
				v = (words[0] + " " + v).replace(/\s+/g, " ").trim();
				continue;
			}
			break;
		}
		return { modelo: m, variante: v };
	},
groupItemsByRow(items, pageHeight, pageNum = 1) {
		if (!items.length) return [];

		const normalized = items
			.filter((item) => item.str && item.str.trim())
			.map((item) => {
				const x = item.transform[4];
				const y = pageHeight - item.transform[5];
				return { x, y, text: item.str.trim(), pageNum };
			})
			.sort((a, b) => a.y - b.y || a.x - b.x);

		const rows = [];
		let currentRow = [normalized[0]];
		let currentY = normalized[0].y;

		for (let i = 1; i < normalized.length; i++) {
			const item = normalized[i];
			if (Math.abs(item.y - currentY) <= 6) {
				currentRow.push(item);
			} else {
				rows.push({
					pageNum,
					y: currentY,
					x: currentRow[0]?.x || 0,
					text: currentRow
						.sort((a, b) => a.x - b.x)
						.map((i) => i.text)
						.join(" "),
				});
				currentRow = [item];
				currentY = item.y;
			}
		}
		if (currentRow.length) {
			rows.push({
				pageNum,
				y: currentY,
				x: currentRow[0]?.x || 0,
				text: currentRow
					.sort((a, b) => a.x - b.x)
					.map((i) => i.text)
					.join(" "),
			});
		}

		return rows;
	},
buildRowContext(rows, priceIdx) {
		const rowText = rows[priceIdx].text;

		const inlineParts = rowText
			.replace(/[¥￥]\s*[\d,]+\.?\d*/g, "")
			.replace(/(?<![¥￥])\$\s*[\d,]+\.?\d*/g, "")
			.trim();

		const isNoise = (t) => {
			if (!t || t.length < 2) return true;
			if (/^[\u4e00-\u9fff\s]+$/.test(t)) return true;
			if (/zhengzhou|damulin/i.test(t)) return true;
			if (/^[\d\s.,-]+$/.test(t)) return true;
			if (
				/^(model|product|picture|image|switch|color|colour|axis|wired|wireless|cny|rmb|usd|price|remark|note|cnyhot)$/i.test(
					t,
				)
			)
				return true;
			if (/^[¥￥]\s*[\d,]/.test(t)) return true;
			if (/^\d{13}$/.test(t)) return true;
			if (/^RZ\d{2}-[\dA-Z-]+$/i.test(t)) return true;
			if (t.length > 120) return true;
			return false;
		};

		const prevLines = [];
		for (
			let j = priceIdx - 1;
			j >= Math.max(0, priceIdx - 8) && prevLines.length < 5;
			j--
		) {
			const t = rows[j].text;
			if (this.extractUsdPrice(t) !== null) break;
			if (!isNoise(t)) prevLines.unshift(t);
		}

		let modelo = "";
		let variante = "";

		const cleanInline =
			inlineParts.length > 1 && !isNoise(inlineParts)
				? inlineParts.replace(/[-\s]+$/g, "").trim()
				: "";

		if (prevLines.length > 0) {
			// El nombre principal del modelo SIEMPRE proviene del encabezado superior (prevLines)
			modelo = prevLines[0].substring(0, 80).trim();
			const restLines = prevLines.slice(1);
			const varParts = [...restLines, cleanInline].filter(Boolean);
			variante = varParts
				.join(" ")
				.replace(/\s+/g, " ")
				.trim()
				.substring(0, 80);
		} else if (cleanInline) {
			modelo = cleanInline.substring(0, 80).trim();
		}

		if (!modelo) return { modelo: "", variante: "", rawText: "" };

		const rawText = (modelo + " " + variante).trim();
		return { modelo, variante, rawText };
	},
hungarianAssign(costMatrix, n) {
		const BIG = 1e12;
		const c = costMatrix.map((row) =>
			row.map((v) => (Number.isFinite(v) ? v : BIG)),
		);
		const u = new Array(n + 1).fill(0);
		const v = new Array(n + 1).fill(0);
		const p = new Array(n + 1).fill(0);
		const way = new Array(n + 1).fill(0);
		for (let i = 1; i <= n; i++) {
			p[0] = i;
			let j0 = 0;
			const minv = new Array(n + 1).fill(BIG);
			const used = new Array(n + 1).fill(false);
			let guard = 0;
			do {
				// Guard anti-loop infinito (fix 05/08): el do-while del húngaro nunca
				// necesita más de n iteraciones (cada una marca used[j0]). Si un caso
				// degenerado (matriz con BIG/valores repetidos) lo hace ciclar, se
				// corta y la fila queda sin asignar — fail-closed, el greedy ya corrió.
				if (++guard > n + 1) break;
				used[j0] = true;
				const i0 = p[j0];
				let delta = Infinity;
				let j1 = -1;
				for (let j = 1; j <= n; j++) {
					if (used[j]) continue;
					const cur = c[i0 - 1][j - 1] - u[i0] - v[j];
					if (cur < minv[j]) {
						minv[j] = cur;
						way[j] = j0;
					}
					if (minv[j] < delta) {
						delta = minv[j];
						j1 = j;
					}
				}
				if (j1 === -1) break; // sin columnas alcanzables: matriz degenerada
				for (let j = 0; j <= n; j++) {
					if (used[j]) {
						u[p[j]] += delta;
						v[j] -= delta;
					} else {
						minv[j] -= delta;
					}
				}
				j0 = j1;
			} while (p[j0] !== 0);
			let guard2 = 0;
			do {
				// Guard anti-loop (fix 05/08): la reconstrucción del camino vía way[]
				// puede ciclar si la matriz degenerada dejó way con un ciclo (medido
				// en 8BitDo p7: cuelgue infinito). Se corta a n+1 pasos — la fila
				// queda sin asignar (fail-closed, el greedy ya corrió).
				if (++guard2 > n + 1) break;
				const j1 = way[j0];
				p[j0] = p[j1];
				j0 = j1;
			} while (j0);
		}
		const assignment = [];
		for (let j = 1; j <= n; j++) {
			if (p[j] > 0 && c[p[j] - 1][j - 1] < BIG) {
				assignment.push({ prodIdx: p[j] - 1, imgIdx: j - 1 });
			}
		}
		return assignment;
	},
_attachImageMeta(product, img) {
		if (!product || !img) return;
		product._interiorColor = img.interiorColor || null;
		product._imgAspect =
			img.width && img.height ? img.width / img.height : null;
	},
medianY(items) {
		if (!Array.isArray(items) || !items.length) return null;
		const ys = items
			.map((it) => (it && typeof it.y === "number" ? it.y : null))
			.filter((y) => y !== null)
			.sort((a, b) => a - b);
		if (!ys.length) return null;
		const mid = Math.floor(ys.length / 2);
		return ys.length % 2 ? ys[mid] : (ys[mid - 1] + ys[mid]) / 2;
	},
buildImageEvidence(
		pdfIdentity,
		pageNum,
		rawImage,
		productRowId,
		association,
	) {
		if (!rawImage) {
			return {
				pdfIdentity: pdfIdentity || "unknown",
				page: pageNum || 0,
				imageFormat: null,
				width: 0,
				height: 0,
				sourcePosition: null,
				canvasDecode: "absent",
				productRowId: productRowId || "",
				association: association || "none",
			};
		}
		const fmt = (rawImage.dataUrl || "").match(/^data:image\/(\w+)/);
		return {
			pdfIdentity: pdfIdentity || "unknown",
			page: pageNum || 0,
			imageFormat: fmt ? fmt[1] : "unknown",
			width: rawImage.width || 0,
			height: rawImage.height || 0,
			sourcePosition: { x: rawImage.x || 0, y: rawImage.y || 0 },
			canvasDecode: this.isValidImageDataUrl(rawImage.dataUrl)
				? "success"
				: "failed",
			productRowId: productRowId || "",
			association: association || "none",
		};
	}
};

if (typeof window !== 'undefined') window.CellUtils = CellUtils;
if (typeof module !== 'undefined') module.exports = CellUtils;

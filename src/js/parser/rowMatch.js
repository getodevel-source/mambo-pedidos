// rowMatch.js — armado de filas, sanitización de nombres y match de imágenes
// extraído de pdfParser.js (parser-row-split, repo-improvement-sprint).
// Mismo patrón que cellUtils/pdfParserClassifier: se asignan a PdfParser con
// Object.assign; `this` se resuelve en runtime contra PdfParser (todas las
// cross-references son this.*). GOLDEN: hash de extracción idéntico
// antes/después (fd0ac1d1...). Doble exposición browser/node.
// Dependencia del scope module de pdfParser (helper puro, mismo código).
const rowEnvFlag = (name) => { try { return typeof process !== "undefined" && process.env ? process.env[name] : undefined; } catch { return undefined; } };

const RowMatch = {
// PIL8: un dígito suelto pegado al nombre ("Air 2", "Zero 2") es dígito de
// versión, no ruido — pero solo con un vecino de texto en la misma línea a la
// izquierda (los specs sueltos como "44" no van pegados a nada). Puro y
// testeable directo (no necesita PDF).
hasGluedNameNeighbor(rawElements, el, maxGap = 40, maxDy = 3) {
	if (!Array.isArray(rawElements) || !el) return false;
	const x = Number(el.x) || 0, y = Number(el.y) || 0;
	return rawElements.some((o) => {
		if (!o || o === el) return false;
		const t = String(o.text != null ? o.text : o.str != null ? o.str : "").trim();
		if (t.length < 2) return false;
		const dx = x - (Number(o.x) || 0);
		return dx > 0 && dx <= maxGap && Math.abs((Number(o.y) || 0) - y) <= maxDy;
	});
},
extractPageProductsByTableRows(
		rawElements,
		priceAnchors,
		viewportHeight,
		pageNum,
		pageImages,
		brandFallback,
		customBrands,
		existingProducts,
		isPageNoise,
		isHeaderNoiseLine,
	) {
		priceAnchors.sort((a, b) => a.y - b.y || a.x - b.x);
		const pageProducts = [];

		// Model inheritance: track last valid model name for color-only rows
		let lastInheritedModel = "";
		let lastInheritedPrice = 0;

		// Determinar la X de la columna de precios USD (promedio de anclas)
		const priceColX =
			priceAnchors.reduce((s, a) => s + a.x, 0) / priceAnchors.length;

		// SLICE 3 (Haimu switch specs): a technical-parameters column sits between
		// the name column and the price (tokens like "stroke:", "material:",
		// "force:", "axle"). When present, numeric/material tokens in that band
		// belong to specs (variante), never to the model name.
		const specKwCount = rawElements.filter((el) => {
			if (el.x < 180 || el.x > priceColX - 60) return false;
			return /(stroke:|material:|force:|cover|axle|bottoming|total\s*stroke|working\s*(stroke|force))/i.test(
				el.text,
			);
		}).length;
		const hasSpecsColumn = specKwCount >= 4;

		// SLICE 1: cabeceras de tabla detectadas (Model | Color | Axis | Image | CNY | USD)
		const tableHeaders = this.detectTableHeaders(rawElements, priceColX);

		// SLICE 1c: logos de marca repetidos por fila. Un token de 2-4 letras
		// mayúsculas puras que aparece en >=50% de las filas es un logo de marca
		// (ej: "RK" en cada fila del catálogo RK) — no es parte del modelo.
		// Códigos de modelo sin dígitos (ej: "MAD" en "MAD 60 V2") aparecen una
		// vez por bloque y sobreviven. Solo se activa con tablas grandes (>=8 filas).
		const logoKill = new Set();
		if (priceAnchors.length >= 8) {
			const counts = {};
			for (const el of rawElements) {
				if (el.x < 100 && /^[A-Z]{2,4}$/.test(el.text)) {
					counts[el.text] = (counts[el.text] || 0) + 1;
				}
			}
			for (const [tok, n] of Object.entries(counts)) {
				if (n >= priceAnchors.length * 0.35) logoKill.add(tok);
			}
		}

		// Calcular altura de fila promedio para límites dinámicos
		let avgRowHeight = 60;
		if (priceAnchors.length > 1) {
			const gaps = [];
			for (let j = 1; j < priceAnchors.length; j++) {
				const gap = priceAnchors[j].y - priceAnchors[j - 1].y;
				if (gap > 5 && gap < 300) gaps.push(gap);
			}
			if (gaps.length)
				avgRowHeight = gaps.reduce((a, b) => a + b, 0) / gaps.length;
		}

		// Regex para detectar códigos de producto (ej: RZ01-03850100-R3C1)
		const CODE_RE = /^[A-Z]{2,4}\d{0,2}\s*-\s*\d{6,}\s*-\s*[A-Z0-9]+$/i;
		// Regex para ¥/￥ CNY
		const CNY_SYMBOL_RE = /^[¥￥]$/;
		// Regex para números CNY bare (ej: 235.75, 1,170.21)
		const CNY_BARE_RE = /^[\d,]+\.\d{1,2}$/;
		// Keywords de tipo de producto
		const TYPE_KEYWORDS =
			/\b(wired|wireless|bluetooth|mechanical|optical|gaming|mouse|keyboard|headset|controller|earphone|earbuds|switch|numpad|mousepad|webcam|camera|microphone|chair|desk|hub|adapter|cable|stand|receiver)\b/i;

		for (let i = 0; i < priceAnchors.length; i++) {
			const anchor = priceAnchors[i];

			// Calcular límites Y dinámicos: punto medio entre anclas consecutivas
			const prevAnchor = i > 0 ? priceAnchors[i - 1] : null;
			const nextAnchor =
				i < priceAnchors.length - 1 ? priceAnchors[i + 1] : null;
			let topBound = prevAnchor
				? (prevAnchor.y + anchor.y) / 2
				: Math.max(0, anchor.y - avgRowHeight * 1.3);
			const bottomBound = nextAnchor
				? (anchor.y + nextAnchor.y) / 2
				: Math.min(viewportHeight, anchor.y + 30);

			// SLICE 1b: la primera fila de datos no debe incluir la fila de cabecera
			// (sus tokens caerian dentro de los bounds y contaminarian el modelo).
			const rowHeader = this.findHeaderAbove(tableHeaders, anchor.y);
			if (rowHeader && topBound < rowHeader.y + 6) topBound = rowHeader.y + 6;

			// Recolectar TODOS los elementos dentro de los límites Y, a la izquierda de la columna de precios
			const cellItems = rawElements.filter((el) => {
				if (el.y < topBound || el.y > bottomBound) return false;
				if (el.x > priceColX - 15) return false; // excluir zona de precios
				return true;
			});

			// Clasificar elementos de la celda
			const nameParts = [];
			let firstCodeY = null;
			const typeParts = [];
			const colorParts = [];
			let productCode = "";

			const allItems = cellItems.sort((a, b) => a.y - b.y || a.x - b.x);

			for (const el of allItems) {
				const txt = el.text;

				// Filtrar ruido
				// SLICE 4: preserve single-letter model suffixes ("G502 X", "M750 M") in
				// the model band — they are part of the code, not noise.
				// PIL8: igual para dígitos de versión pegados ("Air 2") — con
				// vecino de texto se quedan, sueltos se van como antes.
				const singleKept = el.x < 150 && (/^[A-Z]$/.test(txt) || (/^\d$/.test(txt) && this.hasGluedNameNeighbor(rawElements, el)));
				if (isPageNoise(txt) && !singleKept) continue;
				if (isHeaderNoiseLine(txt)) continue;
				// IT15: palabras de plantilla (labels de sección/estado del catálogo)
				// como modelo — "Standard", "Business", "BILL" — nunca son un modelo.
				if (
					/^(standard|business|bill|special)$/i.test(txt.trim()) &&
					el.x < priceColX * 0.5
				)
					continue;

				// Filtrar CNY: símbolo ¥ y números bare cerca de la columna de precios
				if (CNY_SYMBOL_RE.test(txt)) continue;
				if (CNY_BARE_RE.test(txt) && el.x > priceColX - 80) continue;

				// Filtrar precios USD inline (ya tenemos el ancla)
				if (this.extractUsdPrice(txt) !== null) continue;

				// Detectar código de producto
				if (CODE_RE.test(txt.replace(/\s/g, ""))) {
					productCode = txt;
					continue;
				}
				// SLICE 1: si hay cabecera por encima, clasificar por banda de columna.
				// (Layout Model|Color|Axis|Image|CNY|USD: el switch NO contamina el modelo.)
				const header = this.findHeaderAbove(tableHeaders, anchor.y);
				let headerRole;

				// Código parcial (ej: "RZ01" "-" "03850100" "-" "R3C1" como items separados).
				// Con cabecera, la banda modelo ES el código — el filtro solo aplica sin cabecera.
				if (header === null) {
					// Sin cabecera: fragmentos de SKU partida ("RZ01" "-" "03850100" "-" "R3C1").
					if (/^[A-Z]{2,4}\d{0,2}$/.test(txt) && el.x < 100) continue;
					if (/^\d{6,}$/.test(txt)) continue;
					if (/^[A-Z]\d[A-Z]\d$/.test(txt) && el.x < 100) continue;
					if (txt === "-" && el.x < 100) continue;
				} else if (logoKill.has(txt) && el.x < 100) {
					// Con cabecera: logo de marca repetido por fila ("RK" en el catálogo RK).
					continue;
				}

				if (header) {
					headerRole = this.classifyByHeader(header, el.x);
					if (headerRole === "model") {
						// SLICE 1b: residuo de cabecera/sub-cabecera en la banda modelo
						// (ej: el label "Color" de las filas RK61) — nunca es un modelo.
						if (this.HEADER_TOKEN_RE.test(txt)) continue;
						// IT15: en la banda modelo, los valores numéricos puros de specs
						// (Haimu "3.0"/"0.50mn"/"44") son parámetros técnicos, no modelo.
						// PIL8: pero un dígito suelto PEGADO al nombre ("Air 2") es
						// dígito de versión — los specs nunca van pegados al nombre.
						if (/^[\d.]+(\s*(mm|mn|g|kg))?$/i.test(txt.trim()) && !(txt.trim().length === 1 && this.hasGluedNameNeighbor(rawElements, el))) continue;
						nameParts.push(txt);
						if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
						continue;
					}
					if (headerRole === "color") {
						colorParts.push(txt);
						continue;
					}
					if (headerRole === "switch") {
						typeParts.push(txt);
						continue;
					}
					if (headerRole === "skip") continue;
					// role null -> cae a las heurísticas posicionales de abajo
				}

				// Clasificar por posición X relativa a la columna de precios
				const relX = el.x / priceColX; // 0..1 (izquierda..precio)

				// Keywords que siempre van a variante (sin importar posición)
				const isSwitchType =
					/\b(magnetic|hall\s*effect|linear|tactile|clicky|optical|mechanical|hot[\s-]?swap|pcb|gasket|foam|silicone|poron|ixpe|pet|fr4|aluminum|brass|carbon|axis|speed|kailh|kaihua|misty|biluo|gateron|outemu|ttc|hmx)\b/i.test(
						txt,
					);
				const isSensorSpec =
					/\b(paw\d{4}\w*|8k|4k|2\.4g|tri[\s-]?mode|25k|30k|35k|26000|dpi)\b/i.test(
						txt,
					);
				const isConnectionType =
					/\b(bluetooth|wired|wireless|usb[\s-]?c|rgb|nfc)\b/i.test(txt);
				const isDescriptor =
					/\b(print|side|limited|edition|engraving|release|new|matte|glossy|translucent|gradient|aurora|ice|cream|vein|axle|stroke|force|working|lower|upper|core|cover|material|total|bottoming)\b/i.test(
						txt,
					);
				const isColor =
					/\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|faker|wukong|myth|gunmetal|blackberry|berry|periwinkle|neon|flash|shadow|warrior|hunter|night|zenith|iceblade|primordial|wolf|arctic|fox|dream|whimsy|perilla|obsidian|any|tea)\b/i.test(
						txt,
					);

				if (isSwitchType || isSensorSpec || isConnectionType || isDescriptor) {
					// SLICE 3 (Haimu): in a switch-specs layout the left band
					// (x<180) holds the switch NAME (SeaSalt, Brown, Voice Actor),
					// while "Switch"/"Mechanical" there are part of that name.
					if (hasSpecsColumn && el.x < 60) {
						// IT15: una línea de specs EMPIEZA con dígito ("3.0 0.50mn
						// Switch 44 55 Pink Blue") — es parámetro técnico, no nombre.
						if (/^\d/.test(txt.trim())) {
							typeParts.push(txt);
						} else {
							nameParts.push(txt);
							if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
						}
					} else {
						typeParts.push(txt);
					}
				} else if (isColor && !(hasSpecsColumn && el.x < 60)) {
					// Colors ALWAYS go to variante, regardless of X position.
					// SLICE 3 (Haimu): in the switch-name column (x<60) "Brown"/
					// "Blue"/"Red" are switch NAMES, not colors — handled below.
					colorParts.push(txt);
				} else if (relX < 0.45) {
					if (hasSpecsColumn && el.x < 60) {
						// IT15: en la banda de specs (Haimu), los VALORES numéricos
						// puros ("3.0", "0.50mn", "44", "55") son parámetros técnicos,
						// no parte del nombre — van a typeParts, no al modelo.
						if (/^[\d.]+(\s*(mm|mn|g|kg))?$/i.test(txt.trim())) {
							typeParts.push(txt);
						} else {
							nameParts.push(txt);
							if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
						}
					} else if (TYPE_KEYWORDS.test(txt) && txt.split(" ").length <= 3) {
						typeParts.push(txt);
					} else if (
						/^[A-Za-z]+$/.test(txt) &&
						nameParts.some((p) => /\d/.test(p)) &&
						firstCodeY !== null &&
						relX > 0.15 &&
						el.y > firstCodeY + 5
					) {
						// Ya hay un código en el modelo y este token está a la derecha
						// y debajo del código — es el detalle/switch de la celda (ej:
						// "Jade King" debajo de "68HE Ultra").
						typeParts.push(txt);
					} else {
						nameParts.push(txt);
						if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
					}
				} else if (relX < 0.85) {
					if (isColor) {
						colorParts.push(txt);
					} else if (
						hasSpecsColumn &&
						/^[\d.]+(\s*(mm|mn|g|kg))?$|^[±±]$|^(pom|pa|pc|upe|pe|pet|fr4|ixpe|poron|brass|steel|silver)$/i.test(
							txt.trim(),
						)
					) {
						// SLICE 3 (Haimu): numeric spec values and housing materials in
						// the technical-parameters band go to variante, not the model.
						typeParts.push(txt);
					} else if (TYPE_KEYWORDS.test(txt) && txt.split(" ").length <= 3) {
						typeParts.push(txt);
					} else if (
						/^[A-Za-z]+$/.test(txt) &&
						nameParts.some((p) => /\d/.test(p)) &&
						firstCodeY !== null &&
						relX > 0.15 &&
						el.y > firstCodeY + 5
					) {
						typeParts.push(txt);
					} else if (/^v\d+$/i.test(txt.trim()) && allItems.some((o) => o !== el && Math.abs((Number(o.y) || 0) - (Number(el.y) || 0)) <= 6 && /\b(axis|switch)\b/i.test(String(o.text || "")))) {
					// PIL10: versión suelta JUNTO A switch/axis en su misma línea
					// ("Misty Axis V2") — es la versión del switch, no del modelo.
					// Sin switch en la línea (mochila "Backpack V2") no se toca.
					// En la banda modelo (relX<0.45) tampoco se toca nunca.
					typeParts.push(txt);
					} else {
						nameParts.push(txt);
						if (firstCodeY === null && /\d/.test(txt)) firstCodeY = el.y;
					}
				}
				// relX >= 0.85: zona de precios, ya filtrado
			}

			// Construir modelo y variante
			let rawModelo = nameParts.join(" ").replace(/\s+/g, " ").trim();
			const rawVariante = [...typeParts, ...colorParts]
				.join(" ")
				.replace(/\s+/g, " ")
				.trim();

			// SLICE 5: bloque multi-línea — modelo spec puro con código arriba
			// (layout "V8 / PAW3950MAX / Black ¥...") → el modelo es ese código.
			if (rawModelo && this.isSpecOnlyModel(rawModelo)) {
				const blockCode = this.findBlockCodeAbove(
					rawElements,
					isPageNoise,
					topBound,
					0,
					priceColX * 0.35,
				);
				if (rowEnvFlag("P5_DEBUG"))
					console.error(
						`[SLICE5] y=${topBound.toFixed(0)} | raw="${rawModelo}" | found="${blockCode}" | band=0..${(priceColX * 0.35).toFixed(0)}`,
					);
				if (
					blockCode &&
					!rawModelo
						.toLowerCase()
						.includes(blockCode.split(/\s+/)[0].toLowerCase())
				) {
					rawModelo = blockCode;
				}
			}

			// SLICE 2: celdas fusionadas. Una fila sin texto de modelo es
			// continuación de un producto cuya celda de modelo está fusionada
			// (el texto suele estar centrado verticalmente en el bloque).
			const rowModelEmpty = !rawModelo;
			let modelFromSwap = false;
			let swapOriginalVariante = "";
			let inheritedModelFlag = false;
			let inheritedFromPrice = 0;
			// SLICE 5: una fila con modelo spec-only/color-only (sin código real)
			// también hereda — es la 2ª/3ª fila de color de un bloque multi-línea
			// ("Tri mode Berry" bajo un bloque G3). Sin esto, el modelo queda como
			// la spec y el reverse audit promueve basura desde la variante.
			const PURE_COLOR_RE =
				/^(transparent|black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|cream|berry|mint|navy|teal|beige|ivory|charcoal|rose|slate|olive|maroon|aqua|violet|indigo|peach|sky|jade|amber|coral|mocha|latte)$/i;
			// IT15: un modelo que empieza con "(" es una nota del PDF ("(Extra keycap
			// need be ordered...") — nunca un modelo real → tratar como fila bare.
			const noteAsModel = /^\s*\(/.test(rawModelo);
			const modelIsBare =
				noteAsModel ||
				!rawModelo ||
				this.isSpecOnlyModel(rawModelo) ||
				PURE_COLOR_RE.test(rawModelo.trim());
			if (noteAsModel) rawModelo = "";
			// Guarda anti-basura: no heredar modelos ruidosos (líneas de estado de
			// producción, "items Mount Tai ... ceased") como modelo de familia.
			const MODEL_NOISE_RE =
				/\b(items?|ceased|released|production|those|small|only|new|upcoming|total|the)\b/i;
			const inheritOk =
				lastInheritedModel && !MODEL_NOISE_RE.test(lastInheritedModel);
			if (modelIsBare && inheritOk) {
				rawModelo = lastInheritedModel;
				// Don't swap — the color stays in variante
				// SLICE 4: remember we inherited (the model may belong to the fused
				// cell BELOW whose text is centered — price disambiguates later).
				inheritedModelFlag = true;
				inheritedFromPrice = lastInheritedPrice;
			} else if (modelIsBare && rawVariante) {
				// Sin herencia disponible — swap como último recurso: se marca para
				// backfill (la siguiente fila con modelo real corrige el modelo).
				swapOriginalVariante = rawVariante;
				rawModelo = rawVariante;
				modelFromSwap = true;
			}

			if (!rawModelo) continue;

			const rawCombined = rawModelo + " " + rawVariante;
			const detectedBrand =
				this.detectBrandFromTextLine(rawCombined, customBrands) ||
				brandFallback ||
				"OTRO";
			const cat = this.detectCategory(rawCombined, detectedBrand);

			const sanitized = this.sanitizeProductNames(
				rawModelo,
				rawVariante,
				detectedBrand,
				existingProducts,
				hasSpecsColumn,
			);
			// Skip phantom rows: raw content is only a price/header token with no variant
			// (the RMB price column parsed as a row, or a "PRICE PRICE" header) — not a product.
			if (
				!(rawVariante || "").trim() &&
				(/^\$?\d+([.,]\d+)?$/.test((rawModelo || "").trim()) ||
					/^(price|modelo|model|color|picture|image|spec|remark|moq|fob|cny|rmb|usd|eur|\s)+$/i.test(
						(rawModelo || "").trim(),
					))
			) {
				continue;
			}

			// Buscar imagen dentro de los mismos límites Y de la celda CON validación visual
			// Image bounds are wider than text bounds (+25px padding) to catch images
			// positioned slightly outside the midpoint boundaries
			let matchedImg = "-";
			let matchedInterior = null;
			let matchedAspect = null;
			if (pageImages && pageImages.length) {
				const imgTopBound = topBound - 25;
				const imgBottomBound = bottomBound + 25;
				const candidateImgs = pageImages.filter((img) => {
					if (img.pageNum !== pageNum) return false;
					const imgCenterY = img.centerY || img.y;
					if (imgCenterY < imgTopBound || imgCenterY > imgBottomBound)
						return false;
					return true;
				});

				// Fallback por página: si la celda Y no contiene imágenes (fotos desplazadas
				// fuera del rango de la fila), buscar las de la página con rango amplio.
				if (!candidateImgs.length) {
					const pageImgsForRow = pageImages.filter((img) => {
						if (img.pageNum !== pageNum) return false;
						const imgCenterY = img.centerY || img.y;
						const distY = anchor.y - imgCenterY;
						if (distY > 460 || distY < -160) return false;
						return true;
					});
					if (pageImgsForRow.length) {
						const productForRow = {
							cat,
							modelo: sanitized.modelo,
							variante: sanitized.variante,
						};
						const scored = pageImgsForRow
							.map((img) => {
								const imgCenterY = img.centerY || img.y;
								const distY = anchor.y - imgCenterY;
								const validation = this.validateImageForProduct(
									img,
									productForRow,
									true,
								);
								if (!validation.valid) return null;
								const dist = Math.hypot(distY * 1.5, Math.max(0, distY));
								return { img, score: dist + (100 - validation.score) * 150 };
							})
							.filter(Boolean)
							.sort((a, b) => a.score - b.score);
						if (scored[0]) {
							matchedImg = scored[0].img.dataUrl;
						}
					}
				}

				if (candidateImgs.length) {
					// Validar cada candidata y elegir la mejor (score + distancia)
					const product = {
						cat,
						modelo: sanitized.modelo,
						variante: sanitized.variante,
					};
					const pickBest = (relaxed) => {
						let best = null;
						let bestScore = -1;
						for (const img of candidateImgs) {
							const validation = this.validateImageForProduct(
								img,
								product,
								relaxed,
							);
							if (!validation.valid) continue;
							const imgCenterY = img.centerY || img.y;
							const dist = Math.abs(imgCenterY - anchor.y);
							const combined = validation.score - dist; // mayor score, menor distancia
							if (combined > bestScore) {
								bestScore = combined;
								best = img;
							}
						}
						return best;
					};
					// Fallback relajado: mismo criterio que la sección 1 — si el shape gate
					// rechazó todas las fotos, aceptar la mejor con penalty.
					const bestImg = pickBest(false) || pickBest(true);
					if (bestImg) {
						matchedImg = this.isValidImageDataUrl(bestImg.dataUrl)
							? bestImg.dataUrl
							: "-";
						matchedInterior = bestImg.interiorColor || null;
						matchedAspect =
							bestImg.width && bestImg.height
								? bestImg.width / bestImg.height
								: null;
					}
				}
			}

			const grounding = this.verifyGrounding({
				anchor,
				rowTextY: this.medianY(cellItems),
				pageNum,
				pageAnchors: priceAnchors,
			});

			pageProducts.push({
				sku: productCode,
				cat,
				marca: detectedBrand,
				modelo: sanitized.modelo,
				variante: sanitized.variante,
				fob: anchor.price,
				img: matchedImg,
				_interiorColor: matchedInterior,
				_imgAspect: matchedAspect,
				grounded: grounding.grounded,
				groundedFob: grounding.grounded,
				isGroundedPrice: grounding.grounded,
				groundingReason: grounding.reason,
				groundingEvidence: grounding.evidence,
				_rowEvidence: this._buildRowEvidence(
					pageNum,
					this.medianY(cellItems),
					cellItems,
					priceAnchors,
					grounding.evidence,
				),
				rawText: rawCombined,
				cellRawText: rawCombined,
				pageNum,
				x: anchor.x,
				y: anchor.y,
				_keepColorNames: hasSpecsColumn,
			});
			const pushedNow = pageProducts[pageProducts.length - 1];
			pushedNow._inheritedModel = inheritedModelFlag;
			pushedNow._inheritedFromPrice = inheritedFromPrice;

			// SLICE 2 backfill: esta fila tiene modelo real y las anteriores quedaron con
			// un swap de color/switch (celda de modelo fusionada con texto centrado).
			// Corrige TODAS las filas swap consecutivas pendientes (no solo la última).
			// IT15: arranca en length-2 — la fila recién pusheada (length-1) tiene modelo
			// real y nunca lleva _needsModel; sin esto el backfill era dead code y las
			// filas swap de inicio de página (Irok "Black"/"Silver", Logitech "Black")
			// quedaban con el color como modelo.
			if (!rowModelEmpty && !modelFromSwap) {
				for (
					let k = pageProducts.length - 2;
					k >= 0 && pageProducts[k] && pageProducts[k]._needsModel;
					k--
				) {
					const prev = pageProducts[k];
					const restoredVariante = prev.variante || "";
					prev.modelo = sanitized.modelo;
					prev.variante = restoredVariante;
					prev.rawText = (sanitized.modelo + " " + restoredVariante)
						.replace(/s+/g, " ")
						.trim();
					prev.cellRawText = prev.rawText;
					prev.cat = this.detectCategory(prev.rawText, prev.marca);
					prev.marca =
						this.detectBrandFromTextLine(prev.rawText, customBrands) ||
						prev.marca ||
						brandFallback ||
						"OTRO";
					delete prev._needsModel;
				}
			}
			// SLICE 2: marcar filas cuyo "modelo" es un swap — serán corregidas por
			// el backfill de la siguiente fila con modelo real (si existe).
			if (rowModelEmpty && modelFromSwap) {
				const pushed = pageProducts[pageProducts.length - 1];
				pushed._needsModel = true;
				// SLICE 2 fix: la celda fusionada repite el modelo en el texto de
				// detalle (Irok/Mars: "Mars75 Pro" en la columna modelo Y en el
				// detalle) — la variante no debe repetir el modelo extraído.
				const modelTokens = (sanitized.modelo || "")
					.split(/\s+/)
					.map((t) => t.toLowerCase());
				let swapVar = swapOriginalVariante;
				if (modelTokens.length) {
					swapVar = swapVar
						.split(/\s+/)
						.filter((w) => !modelTokens.includes(w.toLowerCase()))
						.join(" ");
				}
				pushed.variante = swapVar.replace(/\s+/g, " ").trim();
				pushed.rawText = (pushed.modelo + " " + pushed.variante)
					.replace(/s+/g, " ")
					.trim();
				pushed.cellRawText = pushed.rawText;
			}

			// Update model inheritance for color-only rows that follow.
			// Un modelo de swap (color/switch) NO debe contaminar la herencia.
			if (
				!modelFromSwap &&
				sanitized.modelo &&
				sanitized.modelo.length > 2 &&
				!/^(item|producto)$/i.test(sanitized.modelo)
			) {
				lastInheritedModel = sanitized.modelo;
				lastInheritedPrice = anchor.price;
			}
		}

		// SLICE 4: fused-cell forward model. A row that inherited a model but whose
		// price differs from the inherited model's price belongs to a NEW fused cell
		// whose model text is centered BELOW (Logitech: "M750 M" below the first
		// price row of its block). Bind by price + Y-overlap: the next row with a
		// real (non-inherited) model and the SAME price wins.
		for (let fi = 0; fi < pageProducts.length; fi++) {
			const fused = pageProducts[fi];
			if (!fused._inheritedModel) continue;
			if (Math.abs(fused.fob - fused._inheritedFromPrice) < 0.01) continue; // same block, fine
			// Price differs from the inherited model's price -> look ahead for a real
			// model with the SAME price within a reasonable Y window.
			const fob = fused.fob;
			for (let fj = fi + 1; fj < pageProducts.length; fj++) {
				const cand = pageProducts[fj];
				if (cand._inheritedModel) continue; // also inherited, not a real model
				if (Math.abs(cand.fob - fob) > 0.01) continue; // different price block
				if (cand.y - fused.y > avgRowHeight * 1.5) break; // too far, not the same cell
				if (cand.modelo && cand.modelo !== fused.modelo) {
					const restoredVariante = fused.variante || "";
					fused.modelo = cand.modelo;
					fused.variante = restoredVariante;
					fused.rawText = (fused.modelo + " " + restoredVariante)
						.replace(/\s+/g, " ")
						.trim();
					fused.cellRawText = fused.rawText;
					fused.cat = this.detectCategory(fused.rawText, fused.marca);
					fused.marca =
						this.detectBrandFromTextLine(fused.rawText, customBrands) ||
						fused.marca ||
						brandFallback ||
						"OTRO";
				}
				break;
			}
		}

		// PIL9: completar la palabra de conexión faltante desde gemelas con
		// evidencia textual (mismo modelo+precio+página, acuerdo total). Va acá:
		// todavía existen los flags _inheritedModel para filtrar donantes.
		this.fillMissingConnectionWords(pageProducts, avgRowHeight);

		for (const p of pageProducts) {
			delete p._needsModel;
			delete p._inheritedModel;
			delete p._inheritedFromPrice;
		}
		return pageProducts;
	},

	// PIL9: una fila sin palabra de conexión (wired/wireless/bluetooth) la toma
	// de una gemela con evidencia textual: mismo modelo+precio+página, modelo NO
	// heredado (tiene su texto en la hoja) y a menos de 1.5 filas de distancia.
	// Solo si TODAS las donantes de acuerdo traen la MISMA palabra (si discrepan
	// no se puede saber cuál vale → no se toca, fail-closed). No inventa modelo:
	// solo completa la variante. Devuelve cuántas rellenó.
	fillMissingConnectionWords(products, avgRowHeight) {
		if (!Array.isArray(products)) return 0;
		// Se preserva el case original de la hoja ("Wired", no "wired").
		const connsOf = (v) => {
			const seenLc = new Set();
			const out = [];
			for (const tok of String(v || "").split(/\s+/)) {
				const lc = tok.toLowerCase();
				if ((lc === "wired" || lc === "wireless" || lc === "bluetooth") && !seenLc.has(lc)) {
					seenLc.add(lc);
					out.push(tok);
				}
			}
			return out;
		};
		const win =
			(Number(avgRowHeight) > 0 ? Number(avgRowHeight) : 60) * 1.5;
		let filled = 0;
		for (const p of products) {
			if (!p || typeof p !== "object") continue;
			if (connsOf(p.variante).length > 0) continue;
			if (typeof p.fob !== "number" || Number.isNaN(p.fob)) continue;
			const pModelo = String(p.modelo || "").trim().toLowerCase();
			if (!pModelo) continue;
			const seen = new Map();
			for (const q of products) {
				if (q === p || !q || typeof q !== "object") continue;
				if (q.pageNum !== p.pageNum) continue;
				if (String(q.modelo || "").trim().toLowerCase() !== pModelo) continue;
				if (typeof q.fob !== "number" || Math.abs(q.fob - p.fob) >= 0.01) continue;
				if (q._inheritedModel) continue;
				if (Math.abs((Number(q.y) || 0) - (Number(p.y) || 0)) > win) continue;
				for (const tok of connsOf(q.variante)) {
				const lc = tok.toLowerCase();
				if (!seen.has(lc)) seen.set(lc, tok);
			}
			}
			if (seen.size === 1) {
				const w = [...seen.values()][0];
				p.variante = (String(p.variante || "").trim() + " " + w).trim();
				p.rawText = (String(p.modelo || "") + " " + p.variante)
					.replace(/\s+/g, " ")
					.trim();
				p.cellRawText = p.rawText;
				filled++;
		}
		}
		return filled;
	},
sanitizeProductNames(
		rawModelo,
		rawVariante,
		brand,
		existingProducts = [],
		keepColorNames = false,
	) {
		let modelo = (rawModelo || "").trim();
		let variante = (rawVariante || "").trim();

		// 1. Limpieza de razones sociales corporativas y texto institucional
		const CORPORATE_NOISE =
			/\b(co\.\s*,?\s*ltd\.?|technology\s+co\.|ltd\.?|inc\.?|corp\.?|company|limited)\b/gi;
		modelo = modelo.replace(CORPORATE_NOISE, "").trim();

		if (brand && brand !== "OTRO") {
			const reBrand = new RegExp("^" + brand + "\\s+", "i");
			modelo = modelo.replace(reBrand, "").trim();
		}

		modelo = modelo
			.replace(
				/\b(model|color|price|rmb|usd|picture|image|spec|remark|moq|fob)\b/gi,
				"",
			)
			.replace(/\s+/g, " ")
			.replace(/^[-\s,:]+|[-\s,:]+$/g, "")
			.trim();

		// 1b. Remover códigos de barras EAN/UPC (13 dígitos) y números de serie largos
		modelo = modelo
			.replace(/\b\d{12,15}\b/g, "")
			.replace(/\s+/g, " ")
			.trim();

		// 1c. Mover specs de sensor a variante (PAW3950MAX, PAW3395, etc.)
		const SENSOR_RE = /\b(paw\d{4}\w*)\b/gi;
		const sensorMatches = modelo.match(SENSOR_RE);
		if (sensorMatches) {
			modelo = modelo.replace(SENSOR_RE, "").replace(/\s+/g, " ").trim();
			variante = (sensorMatches.join(" ") + " " + variante).trim();
		}

		// 1d. Mover colores del modelo a variante
		const COLOR_EXTRACT_RE =
			/\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|periwinkle|lavender|cream|obsidian|sakura|phantom|gunmetal|blackberry|neon|arctic|translucent)\b/gi;
		const colorMatches = modelo.match(COLOR_EXTRACT_RE);
		// SLICE 3 (Haimu switch specs): "Brown"/"Blue"/"Red" are switch NAMES in
		// the left name column, not colors — keep them in the model.
		if (colorMatches && colorMatches.length > 0 && !keepColorNames) {
			const nonColorWords = modelo
				.replace(COLOR_EXTRACT_RE, "")
				.replace(/\s+/g, " ")
				.trim();
			// ALWAYS move colors to variante — even if modelo becomes empty
			modelo = nonColorWords;
			variante = (colorMatches.join(" ") + " " + variante)
				.replace(/\s+/g, " ")
				.trim();
		}

		// 1e. Remover palabras genéricas que no son modelo
		modelo = modelo
			.replace(
				/\b(list|item|product|prodcut|catalog|catalogue|release|sale|pro version|electronic|technology|co\.,?\s*ltd\.?|shenzhen|guangdong|unit|photo|ean|barcode|classification|technical|parameters|description|office|gaming|cny|rmb|bottoming|total|style)\b/gi,
				"",
			)
			.replace(/\b\d+\.\d+mm\b/gi, "") // specs técnicas
			.replace(/\b\d+\.\d+mn\b/gi, "") // typo de mm
			.replace(/\s+/g, " ")
			.replace(/^[-\s,:.]+|[-\s,:.]+$/g, "")
			.trim();

		// Deduplicar palabras en modelo (ej: "AK820 Red AK820 Wired" → "AK820 Red Wired")
		const modWords = modelo.split(/\s+/);
		const uniqueModWords = [];
		for (const w of modWords) {
			if (
				!uniqueModWords.map((x) => x.toLowerCase()).includes(w.toLowerCase())
			) {
				uniqueModWords.push(w);
			}
		}
		modelo = uniqueModWords.join(" ");

		// 1f. Ruido de tipo/estado al final del modelo → variante (WS1):
		//     'Ultimate 2C Controller' → modelo 'Ultimate 2C', variante 'Controller';
		//     'Combo MK120 Mouse' → modelo 'MK120', variante 'Combo Mouse';
		//     'Xbox Keyboard' → modelo 'Xbox', variante 'Keyboard';
		//     'Lake Released' → modelo 'Lake', variante 'New Green Released'.
		//     NUNCA toca pro|wireless|ultra|max|bluetooth|wired|mechanical|gaming
		//     (sufijos legítimos). No toca colores, así que corre también en
		//     layouts de specs de switch (keepColorNames=true) — las guardas de
		//     moveTrailingTypeKeyword protegen los nombres compuestos
		//     ('LatteSwitch', 'ShadowSwitch') y los descriptores puros.
		{
			const moved = this.moveTrailingTypeKeyword(modelo, variante);
			modelo = moved.modelo;
			variante = moved.variante;
		}

		// 2. Si el modelo resultante es puramente numérico/decimal (ej: "235.75" o "$120"), no dejar el precio como modelo
		if (/^\$?\d+([.,]\d+)?$/.test(modelo) || /^\d+$/.test(modelo)) {
			if (variante && !/^\$?\d+([.,]\d+)?$/.test(variante)) {
				modelo = variante;
				variante = "";
			} else {
				const brandLabel = brand && brand !== "OTRO" ? brand : "Producto";
				modelo = `${brandLabel} Item`;
			}
		}

		variante = variante
			.replace(
				/\b(model|color|price|rmb|usd|picture|image|spec|remark|moq|fob)\b/gi,
				"",
			)
			// Remover specs técnicas de switches que contaminan la variante
			.replace(
				/\b(working|lower|upper|axle|core|cover|stroke:?|material:?|force:?|total|pre[\s-]?travel|travel)\b/gi,
				"",
			)
			.replace(/\b\d+\.\d+mm\b/gi, "") // "0.50mm"
			.replace(/\b\d+g\b/gi, "") // "5g" (force grams)
			.replace(/\b(pom|pc|pa|upe|pa12|fr4|ixpe|pet)\b/gi, "") // material codes
			.replace(/[-\s]+$/g, "")
			.replace(/^[-\s]+/g, "")
			.replace(/\bmode\b/i, "3-Mode")
			.replace(/\s+/g, " ")
			.trim();

		const varWords = variante.split(/\s+/);
		const uniqueVarWords = [];
		for (const w of varWords) {
			if (
				!uniqueVarWords.map((x) => x.toLowerCase()).includes(w.toLowerCase())
			) {
				uniqueVarWords.push(w);
			}
		}
		variante = uniqueVarWords.join(" ");

		const COLOR_WORDS =
			/^(pink|green|purple|orange|coffee|white|black|grey|gray|blue|dark blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong|transparent|clear|matte|glossy)[\s\-.]*$/i;
		if (modelo.length <= 18 && COLOR_WORDS.test(modelo.trim())) {
			const familyBase = existingProducts
				.filter((p) => p.marca === brand)
				.slice(-3)
				.reverse()
				.find(
					(p) =>
						p.modelo &&
						p.modelo.length > 15 &&
						!COLOR_WORDS.test(p.modelo.trim()),
				);

			if (familyBase) {
				const baseCore = familyBase.modelo
					.replace(COLOR_WORDS, "")
					.replace(
						/\b(pink|green|purple|orange|coffee|white|black|grey|gray|blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong)\b/gi,
						"",
					)
					.replace(/\s+/g, " ")
					.trim();

				if (baseCore.length > 8) {
					variante = (modelo + (variante ? " " + variante : "")).trim();
					modelo = baseCore;
				}
			}
		}

		// Segunda pasada: remover brand del modelo (puede haber quedado oculto bajo ruido limpiado)
		if (brand && brand !== "OTRO") {
			const reBrand2 = new RegExp(
				"\\b" + brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
				"i",
			);
			modelo = modelo
				.replace(reBrand2, "")
				.replace(/\s+/g, " ")
				.replace(/^[-\s,:.]+|[-\s,:.]+$/g, "")
				.trim();
		}

		// If modelo cleaned to empty but variante holds a real (non-numeric) model, promote it.
		// Fixes catalogs where the model code lands in variante and modelo is header noise
		// (e.g. raw "Price List DQ6" -> modelo="" variante="DQ6" -> modelo="DQ6").
		if (!modelo && variante && !/^\$?\d+([.,]\d+)?$/.test(variante)) {
			modelo = variante;
			variante = "";
		}

		return {
			modelo: modelo || (brand !== "OTRO" ? `${brand} Item` : "Producto"),
			variante,
		};
	},
finalizeCatalogProducts(
		allProducts,
		brandFallback,
		baseLength = 0,
		customBrands = [],
		allImages = [],
	) {
		const products = [];
		const seen = new Set();

		for (let i = 0; i < allProducts.length; i++) {
			const p = allProducts[i];
			const detectedBrand =
				p.marca !== "OTRO" ? p.marca : brandFallback || "OTRO";

			// Limpieza universal de tipo/estado al final del modelo (WS1): los paths
			// que NO pasan por sanitizeProductNames (fallback de texto plano del AI
			// engine, items del LLM) pueden traer la categoría pegada al modelo
			// ('Ultimate 2C Controller', 'Xbox Keyboard'). Acá el fix es idempotente:
			// los productos ya limpios no cambian. Se aplica ANTES del dedup para que
			// la identidad use el modelo limpio.
			{
				const moved = this.moveTrailingTypeKeyword(
					p.modelo || "",
					p.variante || "",
				);
				p.modelo = moved.modelo;
				p.variante = moved.variante;
			}

			const key = (
				detectedBrand +
				"|" +
				p.modelo.substring(0, 50) +
				"|" +
				p.variante.substring(0, 30) +
				"|" +
				p.fob
			).toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);

			p.sku =
				typeof SkuAllocator !== "undefined"
					? SkuAllocator.normalizeSku(p.sku)
					: p.sku;
			p.marca = detectedBrand;

			const sourceWarnings = Array.isArray(p.warnings) ? p.warnings : [];
			p.sourceStatus = p.status || p.sourceStatus;
			p.sourceConfidence = Number.isFinite(p.confidence)
				? p.confidence
				: p.sourceConfidence || null;
			p.sourceWarnings = [...sourceWarnings];

			products.push(p);
		}

		if (typeof SkuAllocator !== "undefined")
			SkuAllocator.allocateBatch(products, []);

		// Image inheritance: products without image inherit from same brand+modelo+category.
		// Category is part of the key on purpose: a keyboard must never inherit a mouse photo
		// (cross-category inheritance produced portrait images on TECLADO products).
		const imageByModel = new Map();
		for (const p of products) {
			const hasImg = typeof p.img === "string" && /^data:image\//i.test(p.img);
			if (hasImg) {
				const modelKey = (p.marca + "|" + p.modelo + "|" + p.cat).toLowerCase();
				if (!imageByModel.has(modelKey)) {
					imageByModel.set(modelKey, p.img);
				}
			}
		}
		for (const p of products) {
			const hasImg = typeof p.img === "string" && /^data:image\//i.test(p.img);
			if (!hasImg) {
				const modelKey = (p.marca + "|" + p.modelo + "|" + p.cat).toLowerCase();
				const inherited = imageByModel.get(modelKey);
				if (inherited) {
					p.img = inherited;
					p._imageInherited = true;
				}
			}
		}

		// Recover real model names for variant rows whose model is a bare color
		// or status word (e.g. "Purple", "released") by adopting the parent row.
		this.recoverGenericModelNames(products);

		// Backfill global de imágenes (doble pase estricto + relajado): las filas
		// que el engine por-fila dejó sin foto (fotos desplazadas de la columna,
		// tiles anchas tipo Logitech, galerías desfasadas) reciben la mejor imagen
		// restante de su página. Es el matcher bipartito por página.
		if (allImages && allImages.length) {
			this.matchImagesToProductsGlobal(products, allImages);
		}

		// Evaluar confianza DESPUÉS de todas las asignaciones de imagen (herencia
		// por modelo + backfill global): evita warnings fantasma de "imagen
		// faltante" en productos que sí terminaron con foto, y evalúa con el
		// modelo ya recuperado (recoverGenericModelNames).
		for (const p of products) {
			const evalScore = this.evaluateItemConfidence(p);
			const srcConf =
				p.sourceConfidence === null || p.sourceConfidence === undefined
					? null
					: p.sourceConfidence;
			p.confidence =
				srcConf === null
					? evalScore.confidence
					: Math.min(srcConf, evalScore.confidence);
			p.status = evalScore.status;
			// Fusionar imgWarnings (validación visual del matcher: monocromática,
			// color mismatch, shape) a warnings para que el preview los muestre.
			const imgW = Array.isArray(p.imgWarnings) ? p.imgWarnings : [];
			p.warnings = [
				...new Set([
					...(p.sourceWarnings || []),
					...evalScore.warnings,
					...imgW,
				]),
			];
			p.qualityReason = p.warnings[0] || "Sin observaciones";
		}

		return products;
	},
matchImagesToProductsGlobal(products, allImages) {
		// Marcadores de coincidencia débil (fail-closed). El matcher registra en
		// imgWarnings las advertencias de VALIDACIÓN VISUAL reales (color no
		// coincide, casi monocromática, shape aceptada en backfill). NO se marcan
		// los mecanismos de recuperación por sí mismos (pase relajado, huérfanas
		// por proximidad, alineación de galería): están verificados como fuentes
		// de fotos correctas en estos catálogos (fotos combo mouse+teclado, AJAZZ
		// 11/11, Irok 7/7). Degradarlos en masa volvería inutilizable el semáforo
		// (1072 YELLOW medidos). El gate weak-image degrada SOLO por señales de
		// foto posiblemente equivocada (casi monocromática = fondo sin producto).
		if (!products || !products.length) return;
		products.forEach((product) => {
			if (!this.isValidImageDataUrl(product.img)) {
				product.img = "-";
				// Wire absent evidence for R9 contract
				if (!product.imageEvidence) {
					product.imageEvidence = this.buildImageEvidence(
						product._pdfIdentity || "unknown",
						product.pageNum || 0,
						null,
						product.sku || "",
						"none",
					);
				}
			}
		});
		if (!allImages || !allImages.length) return;
		// Deduplicar imágenes (mismo dataUrl = misma imagen extraída dos veces)
		const seenUrls = new Set();
		const uniqueImages = allImages.filter((img) => {
			if (!this.isValidImageDataUrl(img.dataUrl) || seenUrls.has(img.dataUrl))
				return false;
			seenUrls.add(img.dataUrl);
			return true;
		});

		const pageNumbers = [...new Set(products.map((p) => p.pageNum))];

		for (const pNum of pageNumbers) {
			const pageProds = products.filter((p) => p.pageNum === pNum);
			const pageImgs = uniqueImages.filter((img) => img.pageNum === pNum);
			if (!pageProds.length || !pageImgs.length) continue;
			const assignedProds = new Set();
			const assignedImgs = new Set();
			const MAX_SCORE = 50000;

			// Matriz de costos por página. relaxed=true afloja las gates duras
			// (shape gate → penalty, distancias mayores) para el backfill.
			const buildMatrix = (relaxed) => {
				const costMatrix = [];
				for (let i = 0; i < pageProds.length; i++) {
					const p = pageProds[i];
					const rowCost = [];

					for (let j = 0; j < pageImgs.length; j++) {
						const img = pageImgs[j];
						const distX = Math.abs(img.x - p.x);
						const distYRaw = p.y - img.y;

						// Hard gate: demasiado lejos → Infinity (no asignar). Gates ajustados
						// (distX 300→200, distY 400→250) para evitar fugas entre columnas/filas densas.
						// El backfill (relaxed) NO relaja la distancia — solo el shape gate.
						const distXLimit = 200;
						const yUpper = 250;
						const yLower = -100;
						if (distX > distXLimit || distYRaw > yUpper || distYRaw < yLower) {
							rowCost.push({
								imgIdx: j,
								prodIdx: i,
								totalScore: Infinity,
								distX,
								distYRaw,
								penalty: Infinity,
								validation: null,
							});
							continue;
						}

						const validation = this.validateImageForProduct(img, p, relaxed);

						// Hard gate: validación visual fallida → Infinity
						if (!validation.valid) {
							rowCost.push({
								imgIdx: j,
								prodIdx: i,
								totalScore: Infinity,
								distX,
								distYRaw,
								penalty: Infinity,
								validation,
							});
							continue;
						}

						let penalty = (100 - validation.score) * 150;
						if (img.y > p.y + 10) penalty += relaxed ? 20000 : 40000;
						if (distX > 160) penalty += 25000;

						const baseDist = Math.hypot(
							distX * 1.5,
							Math.max(0, distYRaw) * 1.0,
						);
						rowCost.push({
							imgIdx: j,
							prodIdx: i,
							totalScore: baseDist + penalty,
							distX,
							distYRaw,
							penalty,
							validation,
						});
					}
					costMatrix.push(rowCost);
				}
				return costMatrix;
			};

			const runGreedy = (costMatrix, relaxed) => {
				while (
					assignedProds.size < pageProds.length &&
					assignedImgs.size < pageImgs.length
				) {
					let minPair = null;

					for (let i = 0; i < pageProds.length; i++) {
						if (assignedProds.has(i)) continue;
						for (let j = 0; j < pageImgs.length; j++) {
							if (assignedImgs.has(j)) continue;
							const pair = costMatrix[i][j];
							if (pair.totalScore === Infinity) continue;
							if (!minPair || pair.totalScore < minPair.totalScore) {
								minPair = pair;
							}
						}
					}

					if (!minPair || minPair.totalScore > MAX_SCORE) break;

					const winnerProd = pageProds[minPair.prodIdx];
					const winnerImg = pageImgs[minPair.imgIdx];

					winnerProd.img = this.isValidImageDataUrl(winnerImg.dataUrl)
						? winnerImg.dataUrl
						: "-";
					if (minPair.validation && minPair.validation.warnings.length) {
						winnerProd.imgWarnings = minPair.validation.warnings;
					}
					// Wire image evidence for R9 contract (Slice 2)
					winnerProd.imageEvidence = this.buildImageEvidence(
						winnerProd._pdfIdentity || "unknown",
						pNum,
						winnerImg,
						winnerProd.sku || "",
						"matched",
					);
					assignedProds.add(minPair.prodIdx);
					assignedImgs.add(minPair.imgIdx);
				}
			};

			// Pase 1: asignación estricta (gates duras).
			runGreedy(buildMatrix(false), false);

			// Pase 2 (backfill): productos que quedaron sin imagen reciben la mejor
			// imagen restante con gates relajadas (shape gate → penalty). Recupera
			// páginas cuyas fotos son todas anchas (Logitech product + specs tiles).
			const stillEmpty = pageProds.some(
				(p, idx) => !assignedProds.has(idx) && !this.isValidImageDataUrl(p.img),
			);
			if (stillEmpty && assignedImgs.size < pageImgs.length) {
				runGreedy(buildMatrix(true), true);
			}

			// Pase 4 (re-optimización húngara — SOLO páginas con fotos compartidas):
			// cuando 2+ productos de la página comparten el MISMO dataUrl (el row
			// engine dio la misma foto al par TECLADO/MOUSE de una línea), el greedy
			// no deshace el cruce y las gates cross-cat desasignan al secundario.
			// La asignación de costo mínimo global (Kuhn-Munkres) le da a cada
			// producto su mejor foto. Solo se aplica un cambio si el nuevo par es
			// ESTRICTAMENTE mejor que el actual (los productos bien asignados no se
			// tocan; los que tienen su foto fuera de las gates la conservan).
			// NOTA ORQUESTADOR (2026-08-06 IT11): ACTIVADO por defecto — el guard
			// anti-loop (CIERRE 05/08) eliminó el colgado (8BitDo: >600s → 1.4s
			// verificado IT6). Desactivar con HUNGARIAN_P4=0 si algún catálogo
			// regresiona (medición de corpus es la evidencia, no la opinión).
			if (rowEnvFlag("HUNGARIAN_P4") !== "0") {
				{
					const urlCount = {};
					for (const pp of pageProds) {
						if (this.isValidImageDataUrl(pp.img))
							urlCount[pp.img] = (urlCount[pp.img] || 0) + 1;
					}
					const hasShared = Object.values(urlCount).some((c) => c > 1);
					if (hasShared && pageProds.length > 1) {
						const matrix = buildMatrix(false);
						const n = Math.max(pageProds.length, pageImgs.length);
						const bigMatrix = [];
						for (let i = 0; i < n; i++) {
							const row = [];
							for (let j = 0; j < n; j++) {
								row.push(
									i < pageProds.length && j < pageImgs.length
										? matrix[i][j].totalScore
										: Infinity,
								);
							}
							bigMatrix.push(row);
						}
						const assignment = this.hungarianAssign(bigMatrix, n);
						for (const { prodIdx, imgIdx } of assignment) {
							if (prodIdx >= pageProds.length || imgIdx >= pageImgs.length)
								continue;
							const prod = pageProds[prodIdx];
							const newCost = matrix[prodIdx][imgIdx].totalScore;
							if (!Number.isFinite(newCost) || newCost > MAX_SCORE) continue;
							let curCost = Infinity;
							if (this.isValidImageDataUrl(prod.img)) {
								for (let j = 0; j < pageImgs.length; j++) {
									if (pageImgs[j].dataUrl === prod.img) {
										curCost = matrix[prodIdx][j].totalScore;
										break;
									}
								}
							}
							if (newCost < curCost) {
								prod.img = pageImgs[imgIdx].dataUrl;
								if (
									matrix[prodIdx][imgIdx].validation &&
									matrix[prodIdx][imgIdx].validation.warnings.length
								) {
									prod.imgWarnings =
										matrix[prodIdx][imgIdx].validation.warnings;
								}
							}
						}
					}
				}
			} // fin HUNGARIAN_P4 guard

			// Pase 3 (galería desfasada): tablas con la galería de fotos desplazada
			// (tabla arriba y fotos ~400-500px debajo, o viceversa — AJAZZ/ATK/AULA).
			// Las gates de distancia no pueden cubrirlo sin arriesgar fugas entre
			// filas densas, así que cuando los productos sin imagen tienen una
			// galería alineable por orden de Y (offset UNIFORME, pitch constante) se
			// alinean fila-i ↔ foto-i. Usa las imágenes crudas de la página (no el
			// dedup global): fotos idénticas repetidas (mismo switch, mismo cable
			// en 2 colores) son compartición legítima, no duplicados.
			const stillEmptyIdx = [];
			for (let i = 0; i < pageProds.length; i++) {
				if (
					!assignedProds.has(i) &&
					!this.isValidImageDataUrl(pageProds[i].img)
				)
					stillEmptyIdx.push(i);
			}
			// Productos con foto COMPARTIDA dentro de la página (el row engine no
			// trackea imágenes usadas: dos filas pueden elegir la misma foto). El
			// secundario buscará su propia imagen libre en el backfill de huérfanas;
			// si no hay, conserva la compartida (los gates la auditan luego).
			const sharedIdx = [];
			const pageUrlCount = {};
			for (const p of pageProds) {
				if (this.isValidImageDataUrl(p.img))
					pageUrlCount[p.img] = (pageUrlCount[p.img] || 0) + 1;
			}
			for (let i = 0; i < pageProds.length; i++) {
				const p = pageProds[i];
				if (assignedProds.has(i) || stillEmptyIdx.includes(i)) continue;
				if (this.isValidImageDataUrl(p.img) && pageUrlCount[p.img] > 1)
					sharedIdx.push(i);
			}
			const usedUrls = new Set();
			for (const j of assignedImgs) usedUrls.add(pageImgs[j].dataUrl);
			// Imágenes tomadas: las del greedy + las que ya tienen dueño en la página
			// (fila con imagen válida que no es huérfana ni compartida). Evita que el
			// backfill vuelva a elegir la foto compartida o robe la de otra fila.
			const orphanSet = new Set([...stillEmptyIdx, ...sharedIdx]);
			for (let i = 0; i < pageProds.length; i++) {
				const p = pageProds[i];
				if (orphanSet.has(i)) continue;
				if (this.isValidImageDataUrl(p.img)) usedUrls.add(p.img);
			}
			const fullPageImgs = (allImages || []).filter(
				(img) => img.pageNum === pNum && !usedUrls.has(img.dataUrl),
			);
			if (
				stillEmptyIdx.length >= 3 &&
				fullPageImgs.length >= stillEmptyIdx.length
			) {
				const prodsAsc = [...stillEmptyIdx].sort(
					(a, b) => pageProds[a].y - pageProds[b].y,
				);
				const imgsAsc = fullPageImgs.slice().sort((a, b) => a.y - b.y);
				const np = prodsAsc.length;
				const maxShift = imgsAsc.length - np;
				let best = null;
				for (let shift = 0; shift <= maxShift; shift++) {
					const dists = prodsAsc.map(
						(pi, k) => pageProds[pi].y - imgsAsc[shift + k].y,
					);
					const mid = dists[Math.floor(dists.length / 2)];
					const dev = Math.max(...dists.map((d) => Math.abs(d - mid)));
					if (dev > Math.max(60, Math.abs(mid) * 0.2)) continue;
					if (!best || dev < best.dev) best = { shift, dev };
				}
				if (best) {
					for (let k = 0; k < np; k++) {
						const prod = pageProds[prodsAsc[k]];
						const img = imgsAsc[best.shift + k];
						prod.img = this.isValidImageDataUrl(img.dataUrl)
							? img.dataUrl
							: "-";
						assignedProds.add(prodsAsc[k]);
					}
				}
			} else if (
				stillEmptyIdx.length + sharedIdx.length >= 1 &&
				stillEmptyIdx.length + sharedIdx.length <= 20 &&
				fullPageImgs.length >= 3
			) {
				if (rowEnvFlag("P3_DEBUG"))
					console.log(
						`[P3] p${pNum} empty=${stillEmptyIdx.length} shared=${sharedIdx.length} free=${fullPageImgs.length}`,
					);
				// Huérfanas individuales: la foto de la fila está ~250-700px debajo del
				// texto (layout foto-bajo-texto con espacio variable). El fallback del
				// row engine (distY < -160) y las gates del matcher (distYRaw < -100)
				// las dejan afuera. La imagen libre MÁS CERCANA en Y (dentro de 700px)
				// que pase la validación relaxed es la de su propia fila: las vecinas
				// ya consumieron las suyas (excluidas vía usedUrls). También entran
				// los productos con foto compartida en la página (sharedIdx): buscan
				// su propia foto antes de que los gates los desasignen.
				const orphans = [...stillEmptyIdx, ...sharedIdx].sort(
					(a, b) => pageProds[a].y - pageProds[b].y,
				);
				let freeSorted = fullPageImgs.slice().sort((a, b) => a.y - b.y);
				for (const pi of orphans) {
					const prod = pageProds[pi];
					let bestImg = null;
					let bestDist = Infinity;
					let bestValidation = null;
					for (const img of freeSorted) {
						const distY =
							prod.y - (img.centerY || img.y + (img.height || 0) / 2);
						if (distY > 460 || distY < -700) continue;
						const validation = this.validateImageForProduct(img, prod, true);
						if (!validation.valid) continue;
						if (Math.abs(distY) < bestDist) {
							bestDist = Math.abs(distY);
							bestImg = img;
							bestValidation = validation;
						}
					}
					if (bestImg) {
						prod.img = this.isValidImageDataUrl(bestImg.dataUrl)
							? bestImg.dataUrl
							: "-";
						assignedProds.add(pi);
						usedUrls.add(bestImg.dataUrl);
						freeSorted = freeSorted.filter((i) => i !== bestImg);
						// Conserva los warnings de VALIDACIÓN VISUAL del ganador (color,
						// casi monocromática) — el gate weak-image los evalúa; el marcador
						// de 'huérfana por proximidad' por sí solo NO degrada (mecanismo
						// verificado: galerías desplazadas de Irok/AULA/RK asignan bien).
						if (
							bestValidation &&
							bestValidation.warnings &&
							bestValidation.warnings.length
						) {
							if (!Array.isArray(prod.imgWarnings)) prod.imgWarnings = [];
							for (const w of bestValidation.warnings) {
								if (!prod.imgWarnings.includes(w)) prod.imgWarnings.push(w);
							}
						}
					}
				}
			}
		}
	}
};
if (typeof window !== 'undefined') window.RowMatch = RowMatch;
if (typeof module !== 'undefined') module.exports = RowMatch;

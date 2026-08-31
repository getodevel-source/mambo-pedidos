// ============================================
//  Mambo Pedidos - Parser de PDFs v4 (Smart Intelligence Engine)
//  Extracción espacial X/Y, puntuación de confianza, soporte para diccionario
//  dinámico de marcas y detector de anomalías de FOB
//  Desarrollado por @geto_dev
// ============================================

// Switches de debug por env-var. Safe en runtime de la app (WebView2) donde
// `process` NO existe (a diferencia de Node, donde corren las auditorías).
// Sin este guard, cada PDF lanzaba "process is not defined" y el import real
// no producía ni un producto (los tests/auditorías en Node nunca lo veían).
const envFlag = (name) => { try { return typeof process !== "undefined" && process.env ? process.env[name] : undefined; } catch { return undefined; } };

const PdfParser = {
	async processPdfFile(
		file,
		catalogLength = 0,
		customBrands = [],
		onProgress = null,
	) {
		let pdf = null;
		try {
			const arrayBuffer = await file.arrayBuffer();
			pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

			const allProducts = [];
			const allImages = [];
			let fullTextForBrand = "";

			// Pre-detectar marca desde el filename para usar como fallback durante la extracción
			const filenameBrand =
				this.detectBrandFromFilename(file.name, customBrands) || "";
			const failedPages = [];
			let imageOnlyPages = 0;

			for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
				if (typeof onProgress === "function") {
					try {
						onProgress(pageNum, pdf.numPages);
					} catch {}
				}
				try {
					const page = await pdf.getPage(pageNum);
const PROFILE = typeof process !== 'undefined' && process.env && process.env.MAMBO_PROFILE_PARSE;
if (PROFILE) console.time('p' + pageNum + '.text');
const content = await page.getTextContent();
					const viewport = page.getViewport({ scale: 1.0 });

					// #9: Track per-page text density for scanned PDF detection
					const pageTextLen = content.items.reduce(
						(sum, item) => sum + (item.str || "").length,
						0,
					);

					if (pageNum <= 3) {
						fullTextForBrand +=
							content.items.map((item) => item.str).join(" ") + " ";
					}

					// Refinar marca con contenido de las primeras 3 páginas
					const currentBrand =
						pageNum <= 3
							? this.detectBrandFromContent(fullTextForBrand, customBrands) ||
								filenameBrand
							: this.detectBrandFromContent(fullTextForBrand, customBrands) ||
								filenameBrand;

					// PIL6 (repo-improvement-sprint): las imágenes de página SON la fase
					// dominante del parse (37,6s de 69,5s medidos) y se decodifican SOLO
					// en páginas que producen productos: primero se detecta con imágenes
					// vacías (solo texto, ~2,3s) y las portadas/índices/specs sin
					// productos no gastan decodificación.
					const pageProducts = this.extractPageProductsByCellGrid(
						content.items, viewport.height, pageNum, [],
						currentBrand, customBrands, allProducts,
					);
					if (pageProducts.length > 0) {
						const pageImages = await this.extractImagesFromPage(page, viewport, pageNum);
						allImages.push(...pageImages);
						if (pageImages.length > 0) {
							const withImages = this.extractPageProductsByCellGrid(
								content.items, viewport.height, pageNum, pageImages,
								currentBrand, customBrands, allProducts,
							);
							if (withImages.length) { pageProducts.length = 0; pageProducts.push(...withImages); }
						}
					}

					if (pageProducts.length > 0) {
						allProducts.push(...pageProducts);
					}
					// #9: Flag pages with almost no text and no products as likely scanned
					if (pageTextLen < 10 && pageProducts.length === 0) {
						imageOnlyPages++;
if (PROFILE) console.timeEnd('p' + pageNum + '.grid');
					}
				} catch (pageErr) {
					failedPages.push({
						page: pageNum,
						error: (pageErr.message || String(pageErr)).substring(0, 100),
					});
					console.warn(
						`PDF página ${pageNum} falló: ${pageErr.message || pageErr}. Continuando con las demás.`,
					);
				}
			}

			if (failedPages.length > 0) {
				console.warn(
					`PDF: ${failedPages.length} de ${pdf.numPages} páginas fallaron: ${failedPages.map((p) => p.page).join(", ")}. ${allProducts.length} productos extraídos de las páginas OK.`,
				);
			}
			// #9: Warn if many pages appear to be scanned images
			if (
				imageOnlyPages > 0 &&
				pdf.numPages > 3 &&
				imageOnlyPages / pdf.numPages > 0.5
			) {
				console.warn(
					`PDF: ${imageOnlyPages} de ${pdf.numPages} páginas parecen escaneadas (sin texto seleccionable). OCR requerido para extracción completa.`,
				);
				if (typeof toast === "function") {
					toast(
						`⚠️ ${imageOnlyPages}/${pdf.numPages} páginas sin texto (escaneadas). OCR necesario para el catálogo completo.`,
						"error",
					);
				}
			}

			const cleanText = fullTextForBrand.replace(/\s+/g, "");
			if (pdf.numPages > 0 && cleanText.length < 20) {
				throw new Error(
					"El PDF no contiene capa de texto seleccionable (imagen escaneada). Requiere OCR.",
				);
			}

			const brand =
				this.detectBrandFromContent(fullTextForBrand, customBrands) ||
				this.detectBrandFromFilename(file.name, customBrands);

			// Sanitización determinística (sin LLM local — limpieza 05/08)
			const enrichedProducts = allProducts.map((item) =>
				typeof TextSanitizer !== "undefined"
					? TextSanitizer.sanitizeItem(item, customBrands)
					: item,
			);

			// Asignar SKU y formatear catálogo final
			const finalProducts = this.finalizeCatalogProducts(
				enrichedProducts,
				brand,
				catalogLength,
				customBrands,
				allImages,
			);
			return { brand, products: finalProducts };
		} finally {
			if (pdf && typeof pdf.destroy === "function") {
				try {
					await pdf.destroy();
				} catch {}
			}
		}
	},

	async extractImagesFromPage(page, viewport, pageNum) {
		const pageImages = [];
		try {
			const ops = await page.getOperatorList();
			const fnArray = ops.fnArray;
			const argsArray = ops.argsArray;

			// P19 RENDER-BASED (06/08): el decode individual (objs.get) decodifica
			// cada foto a su resolución NATIVA (4000px+ = 0.55s×445 → AULA 262s).
			// Ahora: render de la página UNA vez a escala adaptativa — pdf.js
			// decodifica las imágenes a la escala de dibujo durante el render.
			// Las coordenadas x/y/centerY se calculan IGUAL que antes (del CTM),
			// así el matcher imagen→producto no cambia (cero riesgo de cruzado).
			const MAX_DIM = 300;
			// Escala adaptativa por la imagen MÁS CHICA válida (para que hasta los
			// switches de ~25pt queden ≥150px — calidad ≥ baseline). El render a
			// escala alta cuesta ~igual que a escala baja (pdf.js decodifica a la
			// escala de dibujo, no a la nativa): 200ms/página a 6.0x.
			const RENDER_CAP = 6.0;

			// Pre-pase: recolectar imágenes paintImageXObject + su CTM + nativo.
			// Clasificación HÍBRIDA (fix 06/08):
			//  - CTM SANO (drawW≥20, drawH≥20, aspect≤10): recorte del render de
			//    página (rápido — el render decodifica a escala de dibujo, no nativa).
			//  - CTM DEGENERADO (draw chico/deformado pero nativo≥20): decode nativo
			//    con objs.get (camino original). El baseline los incluía (el gate
			//    era sobre el NATIVO) y el pase 3 (galería desfasada) depende de
			//    ese pool exacto — descartarlos cambiaba la asignación (imagen
			//    cruzada). Son POCOS (34 XObjects únicos en AULA) y chicos → costo
			//    despreciable vs. el decode nativo de TODAS las fotos (245s).
			const imageOps = [];
			let minDrawDim = Infinity;
			for (let i = 0; i < fnArray.length; i++) {
				if (fnArray[i] !== pdfjsLib.OPS.paintImageXObject) continue;
				const opArgs = argsArray[i];
				if (!opArgs || opArgs.length === 0) continue;
				const nativeW = Number(opArgs[1]) || 0;
				const nativeH = Number(opArgs[2]) || 0;
				if (nativeW < 20 || nativeH < 20) continue; // gate nativo (como el baseline)
				let ctm = null;
				for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
					if (fnArray[j] === pdfjsLib.OPS.transform) {
						ctm = argsArray[j];
						break;
					}
				}
				let drawW = 0,
					drawH = 0,
					sane = false;
				if (ctm) {
					drawW = Math.abs(Number(ctm[0]) || 0);
					drawH = Math.abs(Number(ctm[3]) || 0);
					sane =
						drawW >= 20 &&
						drawH >= 20 &&
						Math.max(drawW, drawH) / Math.max(1, Math.min(drawW, drawH)) <= 10;
					if (sane) minDrawDim = Math.min(minDrawDim, drawW, drawH);
				}
				imageOps.push({
					idx: i,
					name: opArgs[0],
					ctm,
					nativeW,
					nativeH,
					drawW,
					drawH,
					sane,
				});
			}
			if (imageOps.length === 0) return pageImages;

			// Escala del render: que la imagen sana más chica quede ≥ MAX_DIM.
			let renderScale = 1;
			if (Number.isFinite(minDrawDim) && minDrawDim > 0) {
				renderScale = Math.min(RENDER_CAP, MAX_DIM / minDrawDim);
			}
			renderScale = Math.max(0.5, renderScale);
			const renderViewport = page.getViewport({ scale: renderScale });
			const renderCanvas = document.createElement("canvas");
			renderCanvas.width = Math.max(1, Math.floor(renderViewport.width));
			renderCanvas.height = Math.max(1, Math.floor(renderViewport.height));
			const renderCtx = renderCanvas.getContext("2d");
			if (!renderCtx) return pageImages;

			// Cache de decodes nativos (mismo XObject pintado muchas veces)
			const nativeCache = new Map();
			// Cache de dataUrls del render por XObject: el baseline deduplica por
			// dataUrl (mismo XObject → mismo PNG → 1 imagen en el pool del matcher).
			// El recorte del render del MISMO XObject puede diferir en subpíxeles →
			// dataUrls distintos → sin dedup → pool más grande → pase 3 desalineado
			// (imagen cruzada, verificado: Reaper recibía la letra A del header).
			// Reusar el primer dataUrl por nombre reproduce el dedup del baseline.
			const renderUrlCache = new Map();

			// PASO 1: render de página UNA vez (solo si hay imágenes sanas).
			// Con proxy drawImage: captura la posición REAL de cada imagen en el
			// canvas. El CTM del operatorList tiene un offset de cropBox variable
			// (verificado: recortar por CTM daba la letra A del header para el
			// switch Reaper — imagen cruzada). El render dibuja en el MISMO sistema
			// que getTextContent (productos) → coordenadas reales alinean el matcher.
			let renderDone = false;
			const drawInfo = []; // {px, py, pw, ph} en escala 1.0, orden del operatorList
			const hasSane = imageOps.some((io) => io.sane);
			if (hasSane) {
				const origDrawImage =
					renderCtx.drawImage && renderCtx.drawImage.bind(renderCtx);
				if (typeof renderCtx.drawImage === "function") {
					renderCtx.drawImage = function (...args) {
						let t = null;
						try {
							t = renderCtx.getTransform();
						} catch {}
						if (t && args.length >= 9) {
							const dx = args[5],
								dy = args[6],
								dw = args[7],
								dh = args[8];
							const px = (t.a * dx + t.c * dy + t.e) / renderScale;
							const py = (t.b * dx + t.d * dy + t.f) / renderScale;
							const pw = Math.abs(t.a * dw) / renderScale;
							const ph = Math.abs(t.d * dh) / renderScale;
							drawInfo.push({ px, py, pw, ph });
						}
						return origDrawImage(...args);
					};
				}
				await page.render({
					canvasContext: renderCtx,
					viewport: renderViewport,
				}).promise;
				renderDone = true;
				if (origDrawImage && typeof renderCtx.drawImage === "function") {
					renderCtx.drawImage = origDrawImage;
				}
			}

			// Índice de drawInfo por paint en orden: el render procesa los operadores
			// en el MISMO orden que el operatorList → drawInfo[k] corresponde al
			// k-ésimo paintImageXObject (con nativo≥20) de la página.
			let drawIdx = 0;

			for (const io of imageOps) {
				const { ctm, nativeW, nativeH, drawW, drawH, sane } = io;
				const x = ctm ? Number(ctm[4]) || 0 : 0;
				const y = ctm ? viewport.height - (Number(ctm[5]) || 0) : 0;

				// Posición REAL desde el proxy (si está disponible)
				let realPos = null;
				if (drawIdx < drawInfo.length) {
					const d = drawInfo[drawIdx];
					// sanity: la X real debe estar cerca de la X del CTM (mismo paint)
					if (Math.abs(d.px - x) < 80) realPos = d;
				}
				drawIdx++;

				// ¿Distorsión? El PDF dibuja algunos XObjects con rect de aspecto
				// DISTINTO al nativo (ej. switch nativo 144x109 dibujado en rect
				// portrait). El recorte del render reproduce la distorsión (blur);
				// el baseline usaba el nativo limpio → calidad superior. Umbral 15%.
				let distorted = false;
				if (ctm && nativeW > 0 && nativeH > 0) {
					const drawAspect = drawW / Math.max(1, drawH);
					const nativeAspect = nativeW / Math.max(1, nativeH);
					const diff =
						Math.abs(drawAspect - nativeAspect) / Math.max(0.01, nativeAspect);
					distorted = diff > 0.15;
				}

				if (sane && !distorted && renderDone && realPos) {
					// --- RUTA RENDER (rápida): recorte en la posición REAL ---
					const sx = Math.max(0, Math.floor(realPos.px * renderScale));
					const sy = Math.max(0, Math.floor(realPos.py * renderScale));
					const sw = Math.max(
						1,
						Math.min(
							renderCanvas.width - sx,
							Math.floor(realPos.pw * renderScale),
						),
					);
					const sh = Math.max(
						1,
						Math.min(
							renderCanvas.height - sy,
							Math.floor(realPos.ph * renderScale),
						),
					);
					if (
						sx >= renderCanvas.width ||
						sy >= renderCanvas.height ||
						sw < 1 ||
						sh < 1
					)
						continue;

					let finalDataUrl = "";
					let colorCtx = null;
					let outW = sw;
					let outH = sh;
					try {
						const imgData = renderCtx.getImageData(sx, sy, sw, sh);
						// photo-quality: descartar crops marginales (caso: borde de página
						// tipo MCHOSE — casi blanco con franja). Opt-in si ImageQuality no
						// está cargado (harness Node).
						if (
							typeof ImageQuality !== "undefined" &&
							ImageQuality.isMarginalCrop(imgData)
						) {
							continue;
						}
						const cropCanvas = document.createElement("canvas");
						const scaleUp = Math.min(1, MAX_DIM / Math.max(sw, sh));
						outW = Math.max(1, Math.round(sw * scaleUp));
						outH = Math.max(1, Math.round(sh * scaleUp));
						cropCanvas.width = outW;
						cropCanvas.height = outH;
						const ctx = cropCanvas.getContext("2d");
						if (ctx) {
							ctx.imageSmoothingEnabled = true;
							ctx.imageSmoothingQuality = "high";
							const tmp = document.createElement("canvas");
							tmp.width = sw;
							tmp.height = sh;
							const tmpCtx = tmp.getContext("2d");
							tmpCtx.putImageData(imgData, 0, 0);
							ctx.drawImage(tmp, 0, 0, outW, outH);
							// PNG lossless (igual que el baseline con imgObj.data) — el
							// JPEG 0.85 pixelaba los bordes (nitidez menor, verificado).
							finalDataUrl = cropCanvas.toDataURL("image/png");
							colorCtx = ctx;
						}
					} catch {
						finalDataUrl = "";
					}

					// Dedup por XObject (reproduce el del baseline): mismo XObject →
					// mismo dataUrl → el matcher los colapsa a 1 en el pool.
					if (renderUrlCache.has(io.name)) {
						finalDataUrl = renderUrlCache.get(io.name).url;
					} else if (this.isValidImageDataUrl(finalDataUrl)) {
						renderUrlCache.set(io.name, { url: finalDataUrl });
					}

					if (this.isValidImageDataUrl(finalDataUrl)) {
						const dominantColor = this.extractDominantColor(
							colorCtx,
							outW,
							outH,
						);
						const interiorColor = this.extractInteriorColor(
							colorCtx,
							outW,
							outH,
						);
						pageImages.push({
							pageNum,
							y,
							x,
							width: outW,
							height: outH,
							pdfWidth: drawW,
							pdfHeight: drawH,
							centerY: y + outH / 2,
							dataUrl: finalDataUrl,
							dominantColor,
							interiorColor,
						});
					}
				} else {
					// --- RUTA NATIVA (CTM degenerado o distorsionado): decode nativo ---
					// Tras el render de la página, pdf.js ya decodificó TODOS los
					// XObjects → page.objs.get(name) SIN callback devuelve el objeto
					// al instante (0ms, verificado). El callback con timeout de 2.5s
					// multiplicaba el tiempo (117s en AULA — los timeouts se acumulaban).
					let imgObj = null;
					if (nativeCache.has(io.name)) {
						imgObj = nativeCache.get(io.name);
					} else {
						try {
							if (page.objs && typeof page.objs.get === "function") {
								imgObj = page.objs.get(io.name);
							}
							if (!imgObj) {
								// Fallback: esperar el callback (raro post-render)
								imgObj = await new Promise((resolve) => {
									let settled = false;
									const timer = setTimeout(() => {
										if (!settled) {
											settled = true;
											resolve(null);
										}
									}, 500);
									try {
										page.objs.get(io.name, (obj) => {
											if (!settled) {
												settled = true;
												clearTimeout(timer);
												resolve(obj);
											}
										});
									} catch {
										if (!settled) {
											settled = true;
											clearTimeout(timer);
											resolve(null);
										}
									}
								});
							}
						} catch {
							continue;
						}
						nativeCache.set(io.name, imgObj);
					}

					if (!imgObj || !imgObj.width || !imgObj.height) continue;
					if (imgObj.width < 20 || imgObj.height < 20) continue;
					const aspectRatio =
						Math.max(imgObj.width, imgObj.height) /
						Math.max(1, Math.min(imgObj.width, imgObj.height));
					if (aspectRatio > 10) continue;

					const imgW = Number(imgObj.width);
					const imgH = Number(imgObj.height);
					const scalePre = Math.min(
						1,
						MAX_DIM / Math.max(imgObj.width, imgObj.height),
					);
					const outW = Math.max(1, Math.round(imgObj.width * scalePre));
					const outH = Math.max(1, Math.round(imgObj.height * scalePre));
					let finalDataUrl = "";
					let colorCtx = null;

					if (typeof document !== "undefined") {
						if (imgObj.bitmap) {
							const canvas = document.createElement("canvas");
							canvas.width = outW;
							canvas.height = outH;
							const ctx = canvas.getContext("2d");
							if (ctx) {
								ctx.imageSmoothingEnabled = true;
								ctx.imageSmoothingQuality = "high";
								try {
									ctx.drawImage(imgObj.bitmap, 0, 0, outW, outH);
									finalDataUrl = canvas.toDataURL("image/jpeg", 0.85);
									colorCtx = ctx;
								} catch {
									finalDataUrl = "";
								}
							}
						} else if (imgObj.data) {
							const totalPixels = imgObj.width * imgObj.height;
							const channels = imgObj.data.length / totalPixels;
							if (channels === 4 || channels === 3 || channels === 1) {
								const srcW = imgObj.width;
								const srcH = imgObj.height;
								const scaled = new Uint8ClampedArray(outW * outH * 4);
								const d = imgObj.data;
								const ch = channels;
								for (let yy = 0; yy < outH; yy++) {
									const syf = (yy / outH) * (srcH - 1);
									const sy = Math.min(srcH - 2, Math.floor(syf));
									const fy = syf - sy;
									for (let xx = 0; xx < outW; xx++) {
										const sxf = (xx / outW) * (srcW - 1);
										const sx = Math.min(srcW - 2, Math.floor(sxf));
										const fx = sxf - sx;
										const i00 = (sy * srcW + sx) * ch;
										const i10 = i00 + ch;
										const i01 = i00 + srcW * ch;
										const i11 = i01 + ch;
										const dd = (yy * outW + xx) * 4;
										for (let c = 0; c < 3; c++) {
											const v =
												(d[i00 + c] * (1 - fx) + d[i10 + c] * fx) * (1 - fy) +
												(d[i01 + c] * (1 - fx) + d[i11 + c] * fx) * fy;
											scaled[dd + c] = v;
										}
										scaled[dd + 3] = ch === 4 ? d[i00 + 3] : 255;
									}
								}
								const canvas = document.createElement("canvas");
								canvas.width = outW;
								canvas.height = outH;
								const ctx = canvas.getContext("2d");
								if (ctx) {
									const imgData = ctx.createImageData(outW, outH);
									imgData.data.set(scaled);
									ctx.putImageData(imgData, 0, 0);
									try {
										finalDataUrl = canvas.toDataURL("image/png");
									} catch {
										finalDataUrl = "";
									}
									colorCtx = ctx;
								}
							}
						}
					}

					if (this.isValidImageDataUrl(finalDataUrl)) {
						const dominantColor = this.extractDominantColor(
							colorCtx,
							outW,
							outH,
						);
						const interiorColor = this.extractInteriorColor(
							colorCtx,
							outW,
							outH,
						);
						pageImages.push({
							pageNum,
							y,
							x,
							width: outW,
							height: outH,
							pdfWidth: imgW,
							pdfHeight: imgH,
							centerY: y + outH / 2,
							dataUrl: finalDataUrl,
							dominantColor,
							interiorColor,
						});
					}
				}
			}

			// Imágenes INLINE (iconos chicos, baratas): camino original intacto
			for (let i = 0; i < fnArray.length; i++) {
				if (fnArray[i] !== pdfjsLib.OPS.paintInlineImageXObject) continue;
				const opArgs = argsArray[i];
				if (!opArgs || opArgs.length === 0) continue;
				const imgObj = opArgs[0];
				if (!imgObj || !imgObj.width || !imgObj.height) continue;
				if (imgObj.width < 20 || imgObj.height < 20) continue;
				const aspectRatio =
					Math.max(imgObj.width, imgObj.height) /
					Math.max(1, Math.min(imgObj.width, imgObj.height));
				if (aspectRatio > 10) continue;

				let ctm = null;
				for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
					if (fnArray[j] === pdfjsLib.OPS.transform) {
						ctm = argsArray[j];
						break;
					}
				}
				const imgW = Number(imgObj.width);
				const imgH = Number(imgObj.height);
				const x = ctm ? Number(ctm[4]) || 0 : 0;
				const y = ctm ? viewport.height - (Number(ctm[5]) || 0) : 0;

				const scalePre = Math.min(
					1,
					MAX_DIM / Math.max(imgObj.width, imgObj.height),
				);
				const outW = Math.max(1, Math.round(imgObj.width * scalePre));
				const outH = Math.max(1, Math.round(imgObj.height * scalePre));
				let finalDataUrl = "";
				let colorCtx = null;

				if (typeof document !== "undefined") {
					if (imgObj.bitmap) {
						const canvas = document.createElement("canvas");
						canvas.width = outW;
						canvas.height = outH;
						const ctx = canvas.getContext("2d");
						if (ctx) {
							ctx.imageSmoothingEnabled = true;
							ctx.imageSmoothingQuality = "high";
							try {
								ctx.drawImage(imgObj.bitmap, 0, 0, outW, outH);
								finalDataUrl = canvas.toDataURL("image/jpeg", 0.85);
								colorCtx = ctx;
							} catch {
								finalDataUrl = "";
							}
						}
					} else if (imgObj.data) {
						const totalPixels = imgObj.width * imgObj.height;
						const channels = imgObj.data.length / totalPixels;
						if (channels === 4 || channels === 3 || channels === 1) {
							const srcW = imgObj.width;
							const srcH = imgObj.height;
							const scaled = new Uint8ClampedArray(outW * outH * 4);
							const d = imgObj.data;
							const ch = channels;
							for (let yy = 0; yy < outH; yy++) {
								const syf = (yy / outH) * (srcH - 1);
								const sy = Math.min(srcH - 2, Math.floor(syf));
								const fy = syf - sy;
								for (let xx = 0; xx < outW; xx++) {
									const sxf = (xx / outW) * (srcW - 1);
									const sx = Math.min(srcW - 2, Math.floor(sxf));
									const fx = sxf - sx;
									const i00 = (sy * srcW + sx) * ch;
									const i10 = i00 + ch;
									const i01 = i00 + srcW * ch;
									const i11 = i01 + ch;
									const dd = (yy * outW + xx) * 4;
									for (let c = 0; c < 3; c++) {
										const v =
											(d[i00 + c] * (1 - fx) + d[i10 + c] * fx) * (1 - fy) +
											(d[i01 + c] * (1 - fx) + d[i11 + c] * fx) * fy;
										scaled[dd + c] = v;
									}
									scaled[dd + 3] = ch === 4 ? d[i00 + 3] : 255;
								}
							}
							const canvas = document.createElement("canvas");
							canvas.width = outW;
							canvas.height = outH;
							const ctx = canvas.getContext("2d");
							if (ctx) {
								const imgData = ctx.createImageData(outW, outH);
								imgData.data.set(scaled);
								ctx.putImageData(imgData, 0, 0);
								try {
									finalDataUrl = canvas.toDataURL("image/png");
								} catch {
									finalDataUrl = "";
								}
								colorCtx = ctx;
							}
						}
					}
				}

				if (this.isValidImageDataUrl(finalDataUrl)) {
					const dominantColor = this.extractDominantColor(colorCtx, outW, outH);
					const interiorColor = this.extractInteriorColor(colorCtx, outW, outH);
					pageImages.push({
						pageNum,
						y,
						x,
						width: outW,
						height: outH,
						pdfWidth: imgW,
						pdfHeight: imgH,
						centerY: y + outH / 2,
						dataUrl: finalDataUrl,
						dominantColor,
						interiorColor,
					});
				}
			}
		} catch (err) {
			console.warn("Extracción de imágenes no soportada:", err);
		}
		return pageImages;
	},

	// =========================================================================
	//  VALIDACIÓN VISUAL DE IMÁGENES (Color Dominante + Aspect Ratio)
	// =========================================================================

	/**
	 * Extrae el color dominante de una imagen (ignorando fondo transparente/blanco).
	 * Retorna { name, r, g, b, confidence } donde confidence es el % de píxeles que coinciden.
	 */

	/**
	 * Interior-dominant color over the CENTER-60% crop, background-excluded.
	 * Delegates to ImageTextGates.sampleInteriorColor (Slice 1): the page
	 * background and the photo's own background (corners of the crop) are
	 * excluded, so the result is the PRODUCT color, not the backdrop. Returns
	 * null when the sampler is unavailable.
	 */

	/**
	 * Clasifica un RGB a un nombre de color amplio.
	 */

	/**
	 * Valida que el payload sea un data URL de imagen con un mime soportado.
	 * Es solo forma: no decide si la foto corresponde al producto (eso lo hacen
	 * ImageQuality e ImageTextGates). No existe ninguna capa de visión con LLM:
	 * la app no trae modelo ni endpoint y Ollama nunca fue parte del producto (la
	 * claim del README se borró en e6b2470; este comentario era lo único que lo
	 * mencionaba). Retorna true/false.
	 */

	validateImageForProduct(img, product, relaxed = false) {
		const warnings = [];
		let score = 100;

		if (!img || !this.isValidImageDataUrl(img.dataUrl))
			return { valid: false, score: 0, warnings: ["No image"] };

		// 1. Validación de aspect ratio por categoría
		const aspect = img.width / Math.max(1, img.height);
		const cat = (product.cat || "").toUpperCase();
		const imgMaxDim = Math.max(img.width || 0, img.height || 0);

		// 1a. HARD shape gate: reject images whose silhouette is incompatible with the
		//     product family. Compact products (mouse/headset/controller) cannot have a
		//     wide keyboard/mousepad photo; wide products (keyboard/mousepad) cannot have
		//     a tall narrow photo. Kills cross-family mismatches at the source.
		const COMPACT_CATS = [
			"MOUSE",
			"AURICULAR",
			"HEADSET",
			"CONTROLLER",
			"SWITCH",
		];
		const WIDE_CATS = ["TECLADO", "MOUSEPAD"];
		if (COMPACT_CATS.includes(cat) && aspect > 1.9) {
			if (relaxed) {
				score -= 45;
				warnings.push(
					`⚠️ Imagen ancha (ratio ${aspect.toFixed(2)}) — aceptada en backfill`,
				);
			} else {
				return {
					valid: false,
					score: 0,
					warnings: [
						`🚫 Imagen ancha (ratio ${aspect.toFixed(2)}) incompatible con ${cat}`,
					],
				};
			}
		}
		if (WIDE_CATS.includes(cat) && aspect < 0.65) {
			if (relaxed) {
				score -= 45;
				warnings.push(
					`⚠️ Imagen estrecha (ratio ${aspect.toFixed(2)}) — aceptada en backfill`,
				);
			} else {
				return {
					valid: false,
					score: 0,
					warnings: [
						`🚫 Imagen estrecha (ratio ${aspect.toFixed(2)}) incompatible con ${cat}`,
					],
				};
			}
		}

		// 1b. Low-resolution thumbnail: content/color unreliable at tiny sizes (e.g. Razer
		//     ~50x31pts). Deprioritize (not reject) so a thumbnail only wins if nothing better.
		if (imgMaxDim < 55) {
			score -= 15;
			warnings.push(
				"⚠️ Thumbnail de baja resolución — coincidencia menos confiable",
			);
		}

		if (cat === "TECLADO" && aspect < 0.8) {
			// En relaxed el shape gate ya penalizó (45): no apilar otra penalización
			// dura — las fotos retrato de teclados (ATK, aspect ~0.5) son legítimas.
			score -= relaxed ? 10 : 30;
			warnings.push(
				`⚠️ Imagen muy estrecha (ratio ${aspect.toFixed(2)}) para un teclado`,
			);
		}

		// 2. Validación de color dominante vs variante del producto
		//    Skip en imágenes muy chicas (< 60px) — el color dominante no es confiable
		if (
			img.dominantColor &&
			img.dominantColor.name !== "UNKNOWN" &&
			img.dominantColor.confidence > 25 &&
			imgMaxDim >= 60
		) {
			const imgColor = img.dominantColor.name;
			const variantText = (
				(product.variante || "") +
				" " +
				(product.modelo || "")
			).toLowerCase();

			const COLOR_MAP = {
				black: "BLACK",
				negro: "BLACK",
				white: "WHITE",
				blanco: "WHITE",
				pink: "PINK",
				rosa: "PINK",
				blue: "BLUE",
				azul: "BLUE",
				red: "RED",
				rojo: "RED",
				green: "GREEN",
				verde: "GREEN",
				purple: "PURPLE",
				violeta: "PURPLE",
				lavender: "PURPLE",
				silver: "SILVER",
				gris: "GRAY",
				gray: "GRAY",
				grey: "GRAY",
				gold: "GOLD",
				dorado: "GOLD",
				orange: "ORANGE",
				naranja: "ORANGE",
				cyan: "CYAN",
				teal: "CYAN",
			};

			let expectedColor = null;
			for (const [word, colorName] of Object.entries(COLOR_MAP)) {
				if (variantText.includes(word)) {
					expectedColor = colorName;
					break;
				}
			}

			if (expectedColor && expectedColor !== imgColor) {
				const COMPATIBLE = {
					GRAY: ["SILVER", "WHITE"],
					SILVER: ["GRAY", "WHITE"],
					PURPLE: ["BLUE", "PINK"],
					CYAN: ["BLUE", "GREEN"],
					GOLD: ["ORANGE"],
				};

				const isCompatible = (COMPATIBLE[expectedColor] || []).includes(
					imgColor,
				);
				if (!isCompatible) {
					// En backfill (relaxed) el mismatch de color es solo una señal débil:
					// las fotos combo/producto traen el color dominante del fondo (SILVER/
					// GRAY) mientras el texto dice "Black". Penalizar duro aquí + el penalty
					// de shape (45) hundia el score a 15 y rechazaba la única foto real.
					score -= relaxed ? 10 : 40;
					warnings.push(
						`⚠️ Color de imagen (${imgColor}) no coincide con el producto (${expectedColor})`,
					);
				}
			}
		}

		// 3. Validación de tamaño mínimo
		if (img.width < 30 || img.height < 30) {
			score -= 50;
			warnings.push("⚠️ Imagen demasiado pequeña para ser un producto");
		}

		// 4. Validación de resolución mínima para catálogos
		if (img.width < 50 && img.height < 50) {
			score -= 30;
			warnings.push("⚠️ Resolución muy baja para identificar producto");
		}

		// 5. Ratio de ocupación: el producto debe ocupar una porción razonable del canvas
		//    (evita imágenes que son 95% fondo o 5% ruido)
		if (img.dominantColor && img.dominantColor.confidence > 0) {
			const occupancy = img.dominantColor.confidence; // % de píxeles del color dominante
			if (occupancy > 95) {
				score -= 25;
				warnings.push(
					"⚠️ Imagen casi monocromática — probablemente fondo sin producto",
				);
			}
		}

		return { valid: score >= 35, score, warnings };
	},

	// =========================================================================
	//  MOTOR DE EXTRACCIÓN POR CELDAS ESPACIALES 2D (GRID CELL ENGINE V5)
	//  Aísla productos en celdas espaciales puras [X_min, X_max] x [Y_min, Y_max]
	//  evitando contaminación entre columnas y filtrando ruido de tabla.
	// =========================================================================
	extractPageProductsByCellGrid(
		items,
		viewportHeight,
		pageNum,
		pageImages,
		brandFallback,
		customBrands = [],
		existingProducts = [],
	) {
		if (!items || !items.length) return [];

		// 1. Mapear elementos de texto a coordenadas espaciales
		const rawElements = items
			.filter((item) => item.str && item.str.trim())
			.map((item) => ({
				x: item.transform[4],
				y: viewportHeight - item.transform[5],
				text: item.str.trim(),
				pageNum,
			}));

		// 2. Filtro estricto de Ruido de Encabezados de Tabla & Metadatos
		const NOISE_PATTERN =
			/\b(model|model\s*color|color|price|rmb|usd|picture|image|spec|specification|remark|note|moq|fob|cny|usd\s*price|rmb\s*price)\b/i;

		const isHeaderNoiseLine = (str) => {
			if (!str) return false;
			const matches = str.match(new RegExp(NOISE_PATTERN.source, "gi"));
			return matches && matches.length >= 2;
		};

		const isPageNoise = (str) => {
			if (!str || str.length < 2) return true;
			if (/^[\u4e00-\u9fff\s]+$/.test(str)) return true;
			if (/zhengzhou|damulin|www\.|http|tel:|fax:|page\s*\d+/i.test(str))
				return true;
			if (isHeaderNoiseLine(str)) return true;
			// Ruido de headers de página y nombres corporativos
			if (
				/^(electronic|technology|shenzhen|guangdong|co\.?,?|ltd\.?|inc\.?|corp\.?)$/i.test(
					str,
				)
			)
				return true;
			if (/electronic\s+technology|co\.\s*,?\s*ltd/i.test(str)) return true;
			if (
				/^(product\s+name|prodcut|unit\s+photo|ean\s*barcode|classification|technical\s+parameters|description|office|gaming|series|items?\s+in|those\s+that|ceased\s+production|only\s+small|switches|the\s+items)\b/i.test(
					str,
				)
			)
				return true;
			if (
				/^(name|code|type|category|brand|status|date|version|sku|item|photo|barcode|picture)\s*$/i.test(
					str,
				)
			)
				return true;
			// Stop words en inglés que no son info de producto
			if (
				/^(the|in|are|those|that|have|has|and|only|small|is|it|of|to|for|with|from|by|an|a|or|no|not|all|any|each|more|most|other|some|such|than|too|very|can|will|just|should|now|also|into|over|after|before|between|under|about|up|out|off|down|on|at|as|but|if|then|so|like|when|where|which|who|whom|why|how|what)\s*$/i.test(
					str,
				)
			)
				return true;
			return false;
		};

		// 3. Localizar todos los Anclas de Precio USD ($XX.XX)
		const priceAnchors = [];
		for (const el of rawElements) {
			if (isHeaderNoiseLine(el.text)) continue;
			const price = this.extractUsdPrice(el.text);
			if (price !== null) {
				priceAnchors.push({
					x: el.x,
					y: el.y,
					price,
					rawLine: el.text,
					pageNum,
				});
			}
		}
		if (!priceAnchors.length) return [];

		// 4. Detectar layout: TABLA (1 columna de precios) vs GRILLA (múltiples columnas)
		const uniqueXs = [];
		for (const a of priceAnchors) {
			if (!uniqueXs.some((ux) => Math.abs(ux - a.x) < 40)) {
				uniqueXs.push(a.x);
			}
		}

		const hasSameRowColumns = priceAnchors.some((left, index) =>
			priceAnchors.some(
				(right, rightIndex) =>
					rightIndex > index &&
					Math.abs(left.y - right.y) <= 30 &&
					Math.abs(left.x - right.x) >= 40,
			),
		);
		if (uniqueXs.length === 1 || (uniqueXs.length <= 2 && !hasSameRowColumns)) {
			// TABLE
			return this.extractPageProductsByTableRows(
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
			);
		}

		// --- GRILLA multi-columna (path original) ---
		priceAnchors.sort((a, b) => a.y - b.y || a.x - b.x);
		const pageProducts = [];

		// SLICE 3 (KZ matrix): detect "Model Name" rows — horizontal bands of
		// code-like tokens (EDCX/ZNA/DQS/ZAR/ZVX) under a "型号 / Model Name"
		// header. Each band maps column X -> real model.
		const modelNameRows = this.detectModelNameRows(rawElements, isPageNoise);

		// 4. Construir Bounding Box de Celda 2D determinística para cada Ancla de Precio
		for (let i = 0; i < priceAnchors.length; i++) {
			const anchor = priceAnchors[i];

			// Determinar límites horizontales X de la celda (entre anclas vecinas)
			const sameRowAnchors = priceAnchors.filter(
				(a) => Math.abs(a.y - anchor.y) <= 30,
			);
			sameRowAnchors.sort((a, b) => a.x - b.x);
			const anchorIdxInRow = sameRowAnchors.indexOf(anchor);

			let cellMinX = 0;
			let cellMaxX = 9999;

			if (anchorIdxInRow > 0) {
				cellMinX = (sameRowAnchors[anchorIdxInRow - 1].x + anchor.x) / 2;
			} else if (sameRowAnchors.length > 1) {
				const colWidth = sameRowAnchors[1].x - sameRowAnchors[0].x;
				cellMinX = Math.max(0, anchor.x - colWidth / 2);
			} else {
				cellMinX = Math.max(0, anchor.x - 140);
			}

			if (anchorIdxInRow < sameRowAnchors.length - 1) {
				cellMaxX = (sameRowAnchors[anchorIdxInRow + 1].x + anchor.x) / 2;
			} else if (sameRowAnchors.length > 1) {
				const colWidth =
					(sameRowAnchors[sameRowAnchors.length - 1].x - sameRowAnchors[0].x) /
					(sameRowAnchors.length - 1);
				cellMaxX = anchor.x + colWidth / 2;
			} else {
				cellMaxX = anchor.x + 140;
			}

			// Determinar límites verticales Y de la celda de forma DINÁMICA (Ponytail: sin magic numbers)
			const prevYAnchors = priceAnchors.filter((a) => a.y < anchor.y - 10);
			const prevRowY =
				prevYAnchors.length > 0
					? Math.max(...prevYAnchors.map((a) => a.y))
					: null;
			const rowHeight =
				prevRowY !== null
					? Math.min(240, Math.max(40, anchor.y - prevRowY))
					: 160;

			const cellMinY = anchor.y - rowHeight + 5;
			const cellMaxY = anchor.y + 12;

			// Recolectar elementos de texto STRICTLY dentro del Bounding Box de la Celda
			const cellTextItems = rawElements.filter((el) => {
				if (el.y < cellMinY || el.y > cellMaxY) return false;
				if (el.x < cellMinX - 10 || el.x > cellMaxX + 10) return false;
				if (isPageNoise(el.text)) return false;
				if (this.extractUsdPrice(el.text) !== null) return false;
				return true;
			});

			// Agrupar elementos por sub-filas de Y dentro de la celda
			cellTextItems.sort((a, b) => a.y - b.y || a.x - b.x);

			const cellLines = [];
			if (cellTextItems.length) {
				let curLine = [cellTextItems[0]];
				let curY = cellTextItems[0].y;
				for (let j = 1; j < cellTextItems.length; j++) {
					const item = cellTextItems[j];
					if (Math.abs(item.y - curY) <= 6) {
						curLine.push(item);
					} else {
						cellLines.push(curLine.map((it) => it.text).join(" "));
						curLine = [item];
						curY = item.y;
					}
				}
				if (curLine.length) {
					cellLines.push(curLine.map((it) => it.text).join(" "));
				}
			}

			const inlinePart = anchor.rawLine
				.replace(/[¥￥]\s*[\d,]+\.?\d*/g, "")
				.replace(/(?<![¥￥])\$\s*[\d,]+\.?\d*/g, "")
				.replace(/[-\s]+$/g, "")
				.trim();

			let rawModelo = "";
			let rawVariante = "";

			if (cellLines.length > 0) {
				rawModelo = cellLines[0];
				const restLines = cellLines.slice(1);
				const varParts = [...restLines, inlinePart].filter(
					(p) => p && !isPageNoise(p),
				);
				rawVariante = varParts.join(" ");
			} else if (inlinePart && !isPageNoise(inlinePart)) {
				rawModelo = inlinePart;
			}

			// SLICE 3 (KZ matrix): if the first line is a pure color (a bleed from
			// the PREVIOUS block's color row) and a Model Name row exists above in
			// the same column, the real model is the Model Name token.
			if (modelNameRows.length > 0) {
				const pureColorRe =
					/^(transparent|black|white|silver|grey|gray|blue|red|pink|green|purple|gold|cyan|orange|brown|coffee|cream|teal|navy)$/i;
				const firstLineIsColor = pureColorRe.test((rawModelo || "").trim());
				const codeLess =
					/\b[A-Za-z]+\b/.test(rawModelo || "") && !/\d/.test(rawModelo || "");
				const mnr = this.findModelNameRowAbove(modelNameRows, anchor.y);
				if (mnr && (firstLineIsColor || !rawModelo || codeLess)) {
					const colTok = this.findModelNameTokenAt(mnr, anchor.x);
					if (colTok) {
						// Only override when the current model does NOT already contain a
						// token of the model-name row (keep ZVX PRO, AM16).
						const curTokens = (rawModelo || "")
							.split(/\s+/)
							.map((w) => w.toLowerCase());
						const mnrHasToken = curTokens.some((w) =>
							mnr.tokens.some((t) =>
								t.text.toLowerCase().split(/\s+/).includes(w),
							),
						);
						if (firstLineIsColor || !rawModelo || !mnrHasToken) {
							// Keep the color as variant instead of model.
							if (firstLineIsColor) {
								rawVariante = (rawModelo + " " + rawVariante)
									.replace(/\s+/g, " ")
									.trim();
							}
							rawModelo = colTok;
							// The Model Name token may also appear inside the cell text — drop
							// it from the variant to avoid duplication (KZ matrix).
							const tokLower = colTok.toLowerCase();
							rawVariante = rawVariante
								.split(/\s+/)
								.filter((w) => w.toLowerCase() !== tokLower)
								.join(" ");
						}
					}
				}
			}
			// SLICE 5: bloque multi-línea — si la primera línea es spec pura
			// (sensor, unidad, feature) y hay una línea código arriba en la misma
			// banda X, el modelo es ese código ("V8 / PAW3950MAX / Black ¥...").
			if (
				rawModelo &&
				this.isSpecOnlyModel(rawModelo) &&
				cellTextItems.length
			) {
				const xRef = cellTextItems[0].x;
				const blockCode = this.findBlockCodeAbove(
					rawElements,
					isPageNoise,
					cellMinY,
					xRef - 60,
					xRef + 60,
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
			if (!rawModelo) continue;

			const rawCombined = rawModelo + " " + rawVariante;
			const detectedBrand =
				this.detectBrandFromTextLine(rawCombined, customBrands) ||
				brandFallback ||
				"OTRO";
			const cat = this.detectCategory(rawCombined, detectedBrand);

			// Sanitización quirúrgica de Nombre y Variante
			const sanitized = this.sanitizeProductNames(
				rawModelo,
				rawVariante,
				detectedBrand,
				existingProducts,
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

			// Búsqueda de Imagen STRICTLY dentro del Bounding Box de la Celda
			let matchedImg = "-";
			let matchedInterior = null;
			let matchedAspect = null;
			if (pageImages && pageImages.length) {
				const candidateImgs = pageImages.filter((img) => {
					if (img.pageNum !== pageNum) return false;
					if (img.y > anchor.y + 10 || img.y < anchor.y - 280) return false;
					if (img.x < cellMinX - 30 || img.x > cellMaxX + 30) return false;
					if (!this.isValidImageDataUrl(img.dataUrl)) return false;
					return true;
				});
				// Fallback por página: si la celda X no contiene ninguna imagen
				// (páginas con foto a la izquierda y texto a la derecha, e.g. Logitech),
				// buscar las imágenes de la página cercanas en Y con gates relajadas.
				if (!candidateImgs.length) {
					const pageImgsForRow = pageImages.filter((img) => {
						if (img.pageNum !== pageNum) return false;
						const distX = Math.abs(img.x - anchor.x);
						const distY = anchor.y - img.y;
						if (distX > 420 || distY > 460 || distY < -160) return false;
						return true;
					});
					if (pageImgsForRow.length) {
						const productForImage = {
							cat,
							modelo: sanitized.modelo,
							variante: sanitized.variante,
						};
						const scored = pageImgsForRow
							.map((img) => {
								const distX = Math.abs(img.x - anchor.x);
								const distY = anchor.y - img.y;
								const validation = this.validateImageForProduct(
									img,
									productForImage,
									true,
								);
								if (!validation.valid) return null;
								const dist = Math.hypot(distX * 1.5, Math.max(0, distY));
								return { img, score: dist + (100 - validation.score) * 150 };
							})
							.filter(Boolean)
							.sort((a, b) => a.score - b.score);
						if (scored[0]) {
							matchedImg = scored[0].img.dataUrl;
							matchedInterior = scored[0].img.interiorColor || null;
							matchedAspect =
								scored[0].img.width && scored[0].img.height
									? scored[0].img.width / scored[0].img.height
									: null;
						}
					}
				}

				if (candidateImgs.length) {
					const productForImage = {
						cat,
						modelo: sanitized.modelo,
						variante: sanitized.variante,
					};
					const scoreCandidates = (relaxed) =>
						candidateImgs
							.map((img) => {
								const distX = Math.abs(img.x - anchor.x);
								const distY = anchor.y - img.y;
								const validation = this.validateImageForProduct(
									img,
									productForImage,
									relaxed,
								);
								if (!validation.valid) return null;

								const dist = Math.hypot(distX * 1.5, Math.max(0, distY));
								return { img, score: dist + (100 - validation.score) * 150 };
							})
							.filter(Boolean);

					let scored = scoreCandidates(false).sort((a, b) => a.score - b.score);
					// Fallback relajado: si el shape gate rechazó todas las fotos de la celda
					// (páginas con fotos anchas tipo Logitech), aceptar la mejor con penalty.
					if (!scored.length) {
						scored = scoreCandidates(true).sort((a, b) => a.score - b.score);
					}
					if (scored[0]) {
						matchedImg = scored[0].img.dataUrl;
					}
				}
			}

			const grounding = this.verifyGrounding({
				anchor,
				rowTextY: this.medianY(cellTextItems),
				pageNum,
				pageAnchors: priceAnchors,
			});

			pageProducts.push({
				sku: "",
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
					this.medianY(cellTextItems),
					cellTextItems,
					priceAnchors,
					grounding.evidence,
				),
				rawText: rawCombined,
				cellRawText: rawCombined,
				pageNum,
				x: anchor.x,
				y: anchor.y,
			});
		}

		return pageProducts;
	},

	// =========================================================================
	//  MOTOR DE EXTRACCIÓN POR FILAS DE TABLA (TABLE ROW ENGINE)
	//  Para catálogos con una sola columna de precios (layout tabular).
	//  Cada fila Y con ancla de precio $ = un producto.
	// =========================================================================

	// =========================================================================
	//  DETECCIÓN DE CABECERA DE TABLA (SLICE 1: HEADER-DRIVEN COLUMN MAPPING)
	//  Detecta la fila de cabecera (Model | Color | Axis/Switch | Image | CNY | USD)
	//  y devuelve las columnas por rol y posición X. Si no hay cabecera confiable
	//  devuelve [] -> el engine cae al path posicional actual (sin regresión).
	// =========================================================================
	HEADER_TOKEN_RE:
		/^(model|product|item|color|colour|axis|switch(es)?|key\s*switch(es)?|image|picture|photo|cny|rmb|price|usd|fob)$/i,
	HEADER_ROLE_RE: {
		model: /^(model|product|item)$/i,
		color: /^(color|colour)$/i,
		switch: /^(axis|switch(es)?|key\s*switch(es)?)$/i,
		image: /^(image|picture|photo)$/i,
		cny: /^(cny|rmb|price)$/i,
		usd: /^(usd|fob)$/i,
	},

	// Devuelve la cabecera más cercana por encima de una fila dada.

	// Clasifica un item por su X dentro de las bandas de la cabecera.
	// Devuelve 'model' | 'color' | 'switch' | 'skip' | null (null = fuera de bandas).


	// SLICE 3 (KZ matrix): find horizontal bands of code-like tokens sitting just
	// below a "型号 / Model Name" header. Returns [{ y, tokens: [{x, text}] }].

	// Nearest model-name row above (within 260px) the anchor.

	// Token of the model-name row whose X is closest to anchorX.

	// SLICE 5 (bloques multi-línea): layout "V8 / PAW3950MAX / Black ¥..." —
	// el código del modelo es la línea ARRIBA de la celda (fuera del corte
	// geométrico por 5px). Devuelve el texto de la línea código más cercana
	// por encima de `y` dentro de la banda X [xMin, xMax].

	// ¿El texto de modelo es spec PURA (todos sus tokens son spec/feature/unidad)?
	// Trigger del SLICE 5: "PAW3950MAX", "8KHz", "Tri mode", "Magnetic Charging
	// Dock" → sí (todos los tokens son specs). "99G Air PRO", "Charging Dock
	// Xbox", "Fiber Polar Onyx", "Esports Hall Effect" → NO (tienen tokens de
	// producto real — el peso 99g o el accesorio con nombre propio). Un modelo
	// con un código real (X3 Wireless, V3PRO) tampoco es spec.


	/**
	 * Mueve ruido de tipo/estado desde el FINAL del modelo hacia la variante (WS1).
	 * Reglas (solo si el modelo tiene >= 2 palabras):
	 *  - Última palabra = keyword de tipo (mouse|keyboard|controller|headset|earphone|
	 *    earbuds|numpad|mousepad|webcam|camera|microphone|switch|chair|desk|hub|
	 *    adapter|cable|stand|gamepad|dock|receiver) → variante.
	 *  - Última palabra = estado (released|new|upcoming) → variante.
	 *  - 'combo' como primera palabra es ruido → variante ('Combo MK120 Mouse' →
	 *    modelo 'MK120', variante 'Combo Mouse').
	 * Se aplica en loop (una fila puede arrastrar 'Charing Dock Mouse' →
	 * 'Charing Dock'). Guarda: no deja un descriptor puro como modelo
	 * ('Wireless Keyboard' no se toca: 'Wireless' solo no es un modelo). Nunca
	 * toca pro|wireless|ultra|max|bluetooth|wired|mechanical|gaming (sufijos
	 * legítimos de línea).
	 */


	parseRows(
		rows,
		brandFallback,
		baseLength = 0,
		customBrands = [],
		allImages = [],
	) {
		const products = [];
		const seen = new Set();

		// 1. Parsear todas las filas candidatas a productos
		for (let i = 0; i < rows.length; i++) {
			const rowText = rows[i].text;
			const usdPrice = this.extractUsdPrice(rowText);
			if (usdPrice === null) continue;

			const ctx = this.buildRowContext(rows, i);
			if (!ctx.modelo) continue;

			const detectedBrand =
				this.detectBrandFromTextLine(ctx.rawText, customBrands) ||
				brandFallback ||
				"OTRO";
			const cat = this.detectCategory(ctx.rawText, detectedBrand);

			// Layer 2: Sanitización profunda + Herencia de Familia para títulos truncados
			const rawCombined = ctx.modelo + " " + ctx.variante;
			const cleanTitle = this.cleanProductTitle(rawCombined, detectedBrand);
			let finalModel = cleanTitle.modelo || ctx.modelo;
			let finalVariant = cleanTitle.variante || ctx.variante;

			// Limpiar guiones o restos en variante (ej: "Orange -" -> "Orange", "mode" -> "3-Mode")
			if (finalVariant) {
				finalVariant = finalVariant
					.replace(/[-\s]+$/g, "")
					.replace(/^[-\s]+/g, "")
					.replace(/\bmode\b/i, "3-Mode")
					.trim();
			}

			// Si el modelo resultante es muy corto (solo color/variante), heredar nombre base de la familia
			const COLOR_WORDS =
				/^(pink|green|purple|orange|coffee|white|black|grey|gray|blue|dark blue|red|cyan|teal|brown|mint|navy|lavender|coral|yellow|cream|silver|gold|wukong|transparent|clear|matte|glossy)[\s\-.]*$/i;
			if (
				finalModel.trim().length <= 18 &&
				(COLOR_WORDS.test(finalModel.trim()) ||
					/^[a-z\s-]+[-\s]*$/i.test(finalModel.trim()))
			) {
				const familyBase = products
					.filter((p) => p.marca === detectedBrand && p.cat === cat)
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
						finalVariant = (
							finalModel.trim() + (finalVariant ? " " + finalVariant : "")
						).trim();
						finalModel = baseCore;
					}
				}
			}

			const key = (
				detectedBrand +
				"|" +
				finalModel.substring(0, 50) +
				"|" +
				finalVariant.substring(0, 30) +
				"|" +
				usdPrice
			).toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);

			const catCode = cat.substring(0, 3).toUpperCase();
			const brandCode = detectedBrand.substring(0, 3).toUpperCase();
			const sku = `${brandCode}-${catCode}-${String(baseLength + products.length + 1).padStart(4, "0")}`;

			// Slice 2: matrix path has NO literal anchor - derive grounded:false
			// with evidence (YELLOW via R10, never RED) instead of hardcoded true.
			const grounding = this.verifyGrounding({
				anchor: null,
				rowTextY: rows[i].y || null,
				pageNum: rows[i].pageNum,
				pageAnchors: [],
			});

			products.push({
				sku,
				cat,
				marca: detectedBrand,
				modelo: finalModel,
				variante: finalVariant,
				fob: usdPrice,
				img: "-",
				grounded: grounding.grounded,
				groundedFob: grounding.grounded,
				isGroundedPrice: grounding.grounded,
				groundingReason: grounding.reason,
				groundingEvidence: grounding.evidence,
				_rowEvidence: this._buildRowEvidence(
					rows[i].pageNum,
					rows[i].y || null,
					Array.isArray(rows[i].tokens)
						? rows[i].tokens
						: Array.isArray(rows[i].text)
							? rows[i].text
							: rows[i].text
								? [{ x: rows[i].x || 0, y: rows[i].y || 0, text: rows[i].text }]
								: [],
					[],
					grounding.evidence,
				),
				rawText: ctx.rawText,
				pageNum: rows[i].pageNum,
				x: rows[i].x || 0,
				y: rows[i].y || 0,
			});
		}

		if (typeof SkuAllocator !== "undefined")
			SkuAllocator.allocateBatch(products, []);

		// 2. ASIGNACIÓN GLOBAL BIPARTITA DE IMÁGENES POR PÁGINA (Previene robo de fotos e índices desfasados)
		this.matchImagesToProductsGlobal(products, allImages);

		// 3. Evaluar confianza final para cada producto
		for (const p of products) {
			const evalScore = this.evaluateItemConfidence(p);
			p.confidence = evalScore.confidence;
			p.status = evalScore.status;
			p.warnings = [...new Set([...(p.warnings || []), ...evalScore.warnings])];
			p.sourceWarnings = p.sourceWarnings || [...(p.warnings || [])];
			p.qualityReason = p.warnings[0] || "Sin observaciones";
		}

		return products;
	},

	/**
	 * Detecta si el modelo NO tiene evidencia literal en el cellRawText.
	 * Devuelve { gap, cellCodes, cellText }. gap=true cuando la primera palabra
	 * alfanumérica del modelo (>=4 chars) no aparece en la celda (comparación
	 * sin espacios + tolerancia de prefijo >=3) Y la celda contiene códigos de
	 * producto alternativos (no solo variante/color/estado/tipo/specs). Usado
	 * por evaluateItemConfidence (degradar) y finalizeCatalogProducts (corregir
	 * el modelo cuando la celda tiene UN código con formato de modelo).
	 */
	modelEvidenceGap(item) {
		const cellText = (item.cellRawText || item.rawText || "").trim();
		if (!cellText || !item.modelo)
			return { gap: false, cellCodes: [], cellText };
		const firstWordMatch = item.modelo.match(/[A-Za-z0-9][A-Za-z0-9.-]*/);
		const firstWord = firstWordMatch ? firstWordMatch[0] : "";
		const cellFlat = cellText.replace(/\s+/g, "").toLowerCase();
		const firstFlat = firstWord.replace(/[\s-]/g, "").toLowerCase();
		// Comparación sin espacios + tolerancia de prefijo (Mars75 vs 'Mar 75').
		let hasEvidence = firstFlat.length >= 2 && cellFlat.includes(firstFlat);
		if (!hasEvidence && firstFlat.length >= 3) {
			for (let k = 3; k <= Math.min(5, firstFlat.length); k++) {
				if (cellFlat.includes(firstFlat.slice(0, k))) {
					hasEvidence = true;
					break;
				}
			}
		}
		if (hasEvidence || firstFlat.length < 4)
			return { gap: false, cellCodes: [], cellText };
		const CODE_NOISE_RE =
			/\b(black|white|pink|blue|red|green|purple|grey|gray|silver|gold|orange|brown|cyan|magenta|yellow|coffee|dark|light|transparent|released|new|upcoming|color|wired|wireless|bluetooth|2\.4g|usb|model|price|rmb|usd|cny|keyboard|mouse|controller|headset|earphone|earbuds|numpad|mousepad|webcam|camera|microphone|switch|chair|desk|hub|adapter|cable|stand|gamepad|receiver|mechanical|magnetic|tri|mode|keycap|engraving|mint|side|ice|core|total|bottoming|stroke|upper|lower|cover|material|working|force|axle|tactile|linear|clicky|actuation|travel|spring|stem|housing|factory|lubed|pom|pc|pa|upe|nylon|dustproof|dust|plate|bracket|screw|pre[-\s]?travel|post[-\s]?travel|bottom[- ]?out|noise|silent|smooth|clack|thock|long[- ]?pole|short[- ]?pole)\b/gi;
		const cellCodes = cellText
			.replace(CODE_NOISE_RE, " ")
			.replace(/[^\w\u00C0-\u024F]+/g, " ")
			.trim()
			.split(/\s+/)
			.filter(
				(w) =>
					w.length >= 2 &&
					!/^\d+$/.test(w) &&
					!/^\d+([.,]\d+)?(mn|mm|g|n|hz|khz|mv|mah|db|ms|rpm|kg|v|w|dpi|ips|pf|f|k)\b/i.test(
						w,
					),
			);
		// La marca del propio producto no es evidencia de un modelo distinto
		// ("MChose Red" → codes=[MChose] → gap falso). Se filtra por token.
		const brandTokens = (item.marca || "")
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length >= 2);
		const filteredCodes = cellCodes.filter(
			(w) => !brandTokens.includes(w.toLowerCase()),
		);
		if (envFlag("P1_DEBUG") && cellCodes.length >= 1) {
			console.error(
				`[GRND] "${item.modelo}" | cell="${cellText.slice(0, 80)}" | codes=${cellCodes.join(",")}`,
			);
		}
		return {
			gap: filteredCodes.length >= 1,
			cellCodes: filteredCodes,
			cellText,
		};
	},

	evaluateItemConfidence(item) {
		let confidence = 100;
		const warnings = [];
		const critical = [];

		if (!item.marca || item.marca === "OTRO")
			critical.push("Marca no identificada");
		if (!item.cat || item.cat === "OTRO")
			critical.push("Categoría no identificada");
		if (!item.modelo || item.modelo.length < 2)
			critical.push("Modelo vacío o demasiado corto");

		if (!Number.isFinite(Number(item.fob)) || Number(item.fob) <= 0) {
			critical.push("FOB inválido");
		} else {
			// Range by category: switches legitimately cost $0.19 (SWITCH min 0.05),
			// while a keyboard below $0.50 is suspicious. Reuse the validator ranges.
			const range =
				typeof CatalogValidator !== "undefined" && CatalogValidator.PRICE_RANGES
					? CatalogValidator.PRICE_RANGES[item.cat]
					: null;
			const fobNum = Number(item.fob);
			// Fail-closed (B4): una categoría sin rango conocido (OTRO/desconocida)
			// NUNCA debe dejar un FOB extremo (<$0.05 o >$2000) en GREEN silencioso.
			// La banda conservadora 0.50–350 es más estricta que el piso del spec y
			// cubre el rango intermedio; se mantiene deliberadamente (duda → YELLOW).
			const minFob = range ? Math.max(0.01, range.min * 0.5) : 0.5;
			const maxFob = range ? range.max : 350.0;
			if (fobNum < minFob || fobNum > maxFob) {
				confidence -= 15;
				warnings.push(
					`Precio FOB USD ($${fobNum.toFixed(2)}) inusual o fuera de rango habitual`,
				);
			}
		}

		if (!this.isValidImageDataUrl(item.img)) {
			confidence -= 15;
			warnings.push("Imagen faltante o inválida: requiere revisión");
		}

		// Grounding literal del modelo (B1, fail-closed): la primera palabra
		// alfanumérica del modelo debe aparecer en el texto crudo de su celda/fila.
		// Si no, el modelo pudo mezclarse (specs de otra columna, fila mal unida)
		// -> YELLOW. Solo aplica cuando hay texto crudo (paths espaciales) y la
		// celda contiene un CÓDIGO de producto alternativo: si la celda es solo
		// variante/color/estado (ej 'Purple', 'released Color New Red'), el modelo
		// vino por herencia de familia y es legítimo — no se degrada.
		const gap = this.modelEvidenceGap(item);
		if (gap.gap) {
			confidence -= 20;
			warnings.push(
				`Modelo "${item.modelo}" sin evidencia literal en el texto de la celda`,
			);
		}

		const grounded =
			item.grounded !== undefined ? item.grounded : item.isGroundedFob;
		if (grounded === false) {
			confidence -= 25;
			warnings.push(
				item.groundingReason || "FOB sin evidencia literal suficiente",
			);
		} else if (grounded !== true) {
			critical.push("Evidencia de grounding insuficiente");
		}

		let status = "GREEN";
		if (critical.length > 0) status = "RED";
		else if (confidence < 100 || warnings.length > 0) status = "YELLOW";

		return {
			confidence: Math.max(0, confidence - critical.length * 30),
			status,
			warnings: [...critical, ...warnings],
			critical,
		};
	},

	/**
	 * Recovers real model names for rows whose extracted model is a bare color or
	 * status word (e.g. "Purple", "released", "Black") — a variant row that lost
	 * its parent. The parent is the nearest product above on the same page with
	 * the same brand+category and a non-generic model. The color moves to the
	 * variant and the parent model is adopted.
	 * @returns {number} number of recovered products
	 */
	recoverGenericModelNames(products) {
		const GENERIC_MODEL_RE =
			/^(transparent|black|white|silver|grey|gray|blue|red|pink|green|purple|gold|cyan|orange|brown|coffee|cream|teal|navy|released|new|upcoming)$/i;
		let recovered = 0;
		for (const p of products) {
			const modelo = String(p.modelo || "").trim();
			if (!modelo || !GENERIC_MODEL_RE.test(modelo)) continue;
			if (typeof p.y !== "number" || typeof p.pageNum !== "number") continue;

			// Candidate parents: same brand+category, non-generic model.
			// Priority 1: same FOB (a color/status row is a variant of the row with
			// the same price), on the same page OR the previous page (first row of a
			// continuation block). Priority 2: nearest row above on the same page.
			let sameFob = null;
			let sameFobDist = Infinity;
			let nearest = null;
			let nearestDist = Infinity;

			for (const q of products) {
				if (q === p) continue;
				if (
					String(q.cat || "").toUpperCase() !==
					String(p.cat || "").toUpperCase()
				)
					continue;
				if (
					String(q.marca || "").toLowerCase() !==
					String(p.marca || "").toLowerCase()
				)
					continue;
				const qModelo = String(q.modelo || "").trim();
				if (!qModelo || GENERIC_MODEL_RE.test(qModelo)) continue;
				const qPage = typeof q.pageNum === "number" ? q.pageNum : null;
				const qY = typeof q.y === "number" ? q.y : null;
				if (qY === null || qPage === null) continue;

				const fobMatch =
					typeof p.fob === "number" &&
					typeof q.fob === "number" &&
					Math.abs(p.fob - q.fob) <= 0.01 &&
					(qPage === p.pageNum || qPage === p.pageNum - 1);
				if (fobMatch) {
					const dist = Math.abs(p.y - qY) + (qPage === p.pageNum - 1 ? 500 : 0);
					if (dist < sameFobDist) {
						sameFobDist = dist;
						sameFob = q;
					}
					continue;
				}
				if (qPage === p.pageNum && qY < p.y) {
					const dist = p.y - qY;
					if (dist <= 250 && dist < nearestDist) {
						nearestDist = dist;
						nearest = q;
					}
				}
			}

			const best = sameFob || nearest;
			if (best) {
				p.variante = (modelo + " " + String(p.variante || ""))
					.replace(/\s+/g, " ")
					.trim();
				p.modelo = best.modelo;
				p._modelRecovered = true;
				recovered += 1;
			}
		}
		return recovered;
	},

	/**
	 * Asignación de costo mínimo (Kuhn-Munkres / húngaro, O(n^3)).
	 * costMatrix: n×n con costos (Infinity = prohibido, se usa BIG).
	 * Devuelve [{ prodIdx, imgIdx }] — la asignación óptima global.
	 */


	/**
	 * Slice 1: attach interior color + aspect meta to a product that just
	 * received an image (used by the global matcher paths). ImageTextGates
	 * consumes _interiorColor/_imgAspect on the final product.
	 */

	/**
	 * Median Y of a row's text tokens - the row baseline used by grounding
	 * verification (Slice 2). Returns null when no numeric y is available.
	 */
	_buildRowEvidence(page, rowTextY, textItems, anchors, alignment) {
		return {
			page,
			rowTextY: typeof rowTextY === "number" ? rowTextY : null,
			textItems: (Array.isArray(textItems) ? textItems : []).map((t) => ({
				str:
					t && typeof t.str === "string" ? t.str : String((t && t.text) || ""),
				x: t && typeof t.x === "number" ? t.x : 0,
				y: t && typeof t.y === "number" ? t.y : 0,
				width: t && typeof t.width === "number" ? t.width : 0,
				height: t && typeof t.height === "number" ? t.height : 0,
				page,
			})),
			anchors: (Array.isArray(anchors) ? anchors : []).map((a) => ({
				x: a && typeof a.x === "number" ? a.x : 0,
				y: a && typeof a.y === "number" ? a.y : 0,
				str:
					a && typeof a.rawLine === "string"
						? a.rawLine
						: a && typeof a.str === "string"
							? a.str
							: "",
			})),
			alignment: {
				dx: alignment && typeof alignment.dx === "number" ? alignment.dx : 0,
				dy: alignment && typeof alignment.dy === "number" ? alignment.dy : null,
			},
		};
	},

	/**
	 * Slice 2 (fob-grounding-integrity): DERIVES `grounded` from anchor-to-row
	 * geometry instead of trusting the literal-anchor presence. The FOB anchor
	 * must be on the same page, horizontally aligned with the row's text
	 * baseline (same column band), and the NEAREST candidate anchor to that
	 * row - otherwise the price probably belongs to a neighbor (fused cell /
	 * shifted column). Unverifiable anchors degrade to YELLOW (never RED); RED
	 * stays reserved for missing/invalid FOB.
	 *
	 * @param {Object} opts
	 * @param {Object|null} opts.anchor - The price anchor used for this product
	 * @param {number|null} opts.rowTextY - Median Y of the row's text tokens
	 * @param {number} opts.pageNum
	 * @param {Array} opts.pageAnchors - All price anchors of the page
	 * @param {number} [opts.columnTolerance=40] - grid engine column epsilon
	 * @param {number} [opts.rowTolerance=30] - engine same-row epsilon
	 * @returns {{grounded:boolean, reason:string, evidence:Object}}
	 */
	verifyGrounding({
		anchor,
		rowTextY,
		pageNum,
		pageAnchors,
		columnTolerance = 40,
		rowTolerance = 30,
	}) {
		const page = pageNum;
		const price = anchor ? anchor.price : null;

		// 1. Absent anchor (matrix/fallback path): nothing to verify.
		if (
			!anchor ||
			typeof anchor.x !== "number" ||
			typeof anchor.y !== "number"
		) {
			return {
				grounded: false,
				reason: "FOB sin ancla literal verificada",
				evidence: {
					groundingMode: "geometric",
					page,
					anchorX: null,
					rowX: null,
					dx: null,
					dy: null,
					price,
				},
			};
		}

		// 2. Same-column band (the grid engine's column tolerance).
		const band = (pageAnchors || []).filter(
			(a) =>
				a &&
				typeof a.x === "number" &&
				Math.abs(a.x - anchor.x) <= columnTolerance,
		);

		// 3. Nearest anchor to the row text baseline (the anchor itself included).
		const rowY =
			typeof rowTextY === "number" && Number.isFinite(rowTextY)
				? rowTextY
				: null;
		if (rowY === null) {
			return {
				grounded: false,
				reason: "ancla no alineada",
				evidence: {
					groundingMode: "geometric",
					page,
					anchorX: anchor.x,
					rowX: anchor.x,
					dx: 0,
					dy: null,
					price,
				},
			};
		}
		let nearest = anchor;
		let minDist = Math.abs(anchor.y - rowY);
		for (const a of band) {
			const d = Math.abs(a.y - rowY);
			if (d < minDist) {
				minDist = d;
				nearest = a;
			}
		}

		// 3.5 (assignment-anchors): MATRIX MODE — tarifa común.
		// La verificación geométrica falla (fila vecina / no alineada) pero la
		// página tiene una FILA DE PRECIOS COMPARTIDA (>=3 anclas al mismo y,
		// p.ej. KZ "Model Name | USD PRICE"): en matrices el precio de la
		// columna es correcto aunque no esté en la fila del modelo. En tablas
		// normales el precio está en la fila del producto y la geometría pasa,
		// así que este camino solo convierte fallos reales.
		const pageYCount = {};
		for (const a of pageAnchors || []) {
			if (a && typeof a.y === "number") {
				const k = Math.round(a.y / 4);
				pageYCount[k] = (pageYCount[k] || 0) + 1;
			}
		}
		const matrixRow = Object.values(pageYCount).some((n) => n >= 3);
		if (matrixRow) {
			return {
				grounded: true,
				reason: "matriz: precio por columna en fila de tarifa común",
				evidence: {
					groundingMode: "matrix-row",
					page,
					anchorX: anchor.x,
					rowX: anchor.x,
					dx: 0,
					dy: null,
					price,
				},
			};
		}

		// 4. Fused cell / shifted column: a neighbor anchor is closer to this row.
		if (nearest !== anchor) {
			return {
				grounded: false,
				reason: "ancla de fila vecina",
				evidence: {
					groundingMode: "geometric",
					page,
					anchorX: anchor.x,
					rowX: nearest.x,
					dx: nearest.x - anchor.x,
					dy: minDist,
					price,
				},
			};
		}

		// 5. Vertical alignment: the anchor must be within the row tolerance.
		const dy = anchor.y - rowY;
		if (Math.abs(dy) > rowTolerance) {
			return {
				grounded: false,
				reason: "ancla no alineada",
				evidence: {
					groundingMode: "geometric",
					page,
					anchorX: anchor.x,
					rowX: anchor.x,
					dx: 0,
					dy,
					price,
				},
			};
		}

		// 6. Verified: anchor belongs to this row.
		return {
			grounded: true,
			reason: "FOB verificado por geometría de fila",
			evidence: {
				groundingMode: "geometric",
				page,
				anchorX: anchor.x,
				rowX: anchor.x,
				dx: 0,
				dy,
				price,
			},
		};
	},

	/**
	 * Build structured image evidence for the R1-R10 contract (Slice 2).
	 * Records PDF identity, page, decode result, dimensions, position, and association.
	 * @param {string} pdfIdentity - SHA-256 or stable identifier of the source PDF
	 * @param {number} pageNum - 1-based page number
	 * @param {Object|null} rawImage - Extracted image {width,height,x,y,dataUrl} or null
	 * @param {string} productRowId - SKU or row identity this evidence belongs to
	 * @param {string} association - 'matched' | 'none' | 'ambiguous'
	 * @returns {Object} Structured evidence for evaluateItem R9
	 */
};

if (typeof window !== "undefined") window.PdfParser = PdfParser;
// IT35: clasificador puro extraído (pdfParserClassifier.js) — marca, categoría,
// precio y limpieza de títulos. Se asigna acá para preservar la API PdfParser.*
// (browser: global cargado antes; node: require fallback para ground-truth/measure).
if (typeof PdfParserClassifier !== "undefined") {
	Object.assign(PdfParser, PdfParserClassifier);
} else if (typeof module !== "undefined" && typeof require === "function") {
	// PIL6 (repo-improvement-sprint): helpers puros extraídos a cellUtils.js
	try {
		Object.assign(PdfParser, require("./parser/cellUtils.js"));
	try {
		Object.assign(PdfParser, require("./parser/rowMatch.js"));
	} catch (e) {}
	if (typeof window !== "undefined" && typeof window.RowMatch === "object") {
		Object.assign(PdfParser, window.RowMatch);
	}
	} catch (e) {}
	if (typeof window !== "undefined" && typeof window.CellUtils === "object") {
		Object.assign(PdfParser, window.CellUtils);
	}

	try {
		Object.assign(PdfParser, require("./pdfParserClassifier.js"));
	} catch (e) {}
}

if (typeof module !== "undefined") module.exports = PdfParser;

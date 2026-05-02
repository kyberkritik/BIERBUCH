const IMAGE_EXTENSIONS = ["jpeg", "jpg", "png", "webp"];

async function loadManifest() {
  const res = await fetch("data/beers.json");
  if (!res.ok) throw new Error("No se pudo cargar data/beers.json");
  return res.json();
}

async function loadBeer(barcode) {
  const res = await fetch(`data/barcodes/${barcode}.json`);
  if (!res.ok) throw new Error(`No se pudo cargar ${barcode}.json`);
  return res.json();
}

async function resolveImage(barcode) {
  for (const ext of IMAGE_EXTENSIONS) {
    const path = `images/${barcode}.${ext}`;
    try {
      const head = await fetch(path, { method: "HEAD" });
      if (head.ok) return path;
    } catch (_) {}
  }
  return null;
}

function fmt(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function renderStats(p) {
  const abv = p.alcohol_by_volume_percent;
  const vol = p.net_content ? `${p.net_content.value} ${p.net_content.unit}` : "—";
  const style = p.style || (Array.isArray(p.category) ? p.category.find(c => /lager|ale|stout|pilsner|porter|wheat/i.test(c)) : null) || "—";
  const country = p.country_of_origin_reported || "—";
  return `
    <div class="stats">
      <div class="stat"><span class="stat__label">ABV</span><span class="stat__value stat__value--accent">${fmt(abv)}%</span></div>
      <div class="stat"><span class="stat__label">Volumen</span><span class="stat__value">${vol}</span></div>
      <div class="stat"><span class="stat__label">Estilo</span><span class="stat__value">${fmt(style)}</span></div>
      <div class="stat"><span class="stat__label">Origen</span><span class="stat__value">${fmt(country)}</span></div>
    </div>
  `;
}

function renderTags(categories) {
  if (!Array.isArray(categories) || !categories.length) return "";
  return `<div class="tags">${categories.map(c => `<span class="tag">${c}</span>`).join("")}</div>`;
}

function renderIngredients(ing) {
  if (!ing) return "";
  const list = ing.official_damm_es || ing.official || ing.list || [];
  const allergens = ing.allergens || [];
  return `
    <div class="section">
      <h3>Ingredientes</h3>
      ${list.length ? `<ul>${list.map(i => `<li>${i}</li>`).join("")}</ul>` : "<p>—</p>"}
      ${allergens.length ? `<div class="tags" style="margin-top:12px">${allergens.map(a => `<span class="tag tag--accent">${a}</span>`).join("")}</div>` : ""}
      ${ing.market_variant_note ? `<p style="margin-top:12px;color:var(--muted);font-size:13px">${ing.market_variant_note}</p>` : ""}
    </div>
  `;
}

function renderNutrition(n) {
  if (!n) return "";
  const rows = [
    ["Energía", n.energy ? `${n.energy.kj} kJ / ${n.energy.kcal} kcal` : null],
    ["Grasas", n.fat_g != null ? `${n.fat_g} g` : null],
    ["Saturadas", n.saturates_g != null ? `${n.saturates_g} g` : null],
    ["Hidratos", n.carbohydrates_g != null ? `${n.carbohydrates_g} g` : null],
    ["Azúcares", n.sugars_g != null ? `${n.sugars_g} g` : null],
    ["Proteínas", n.protein_g != null ? `${n.protein_g} g` : null],
    ["Sal", n.salt_g != null ? `${n.salt_g} g` : null],
  ].filter(([, v]) => v !== null);
  if (!rows.length) return "";
  return `
    <div class="section">
      <h3>Nutrición · por 100 ml</h3>
      <dl class="kv">
        ${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}
      </dl>
    </div>
  `;
}

function renderProductInfo(p) {
  const rows = [
    ["Marca", p.brand],
    ["Fabricante", Array.isArray(p.brand_owner_or_manufacturer) ? p.brand_owner_or_manufacturer.join(" · ") : p.brand_owner_or_manufacturer],
    ["Ubicación", p.production_or_company_location_reported],
    ["Envase", p.container_observed],
    ["Servir a", p.serving_temperature_celsius_observed ? `${p.serving_temperature_celsius_observed.min}–${p.serving_temperature_celsius_observed.max} °C` : null],
    ["Caja", p.case_pack_observed ? `${p.case_pack_observed.quantity} ${p.case_pack_observed.unit}` : null],
  ].filter(([, v]) => v);
  return `
    <div class="section">
      <h3>Producto</h3>
      <dl class="kv">
        ${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}
      </dl>
    </div>
  `;
}

function renderIdentifiers(id) {
  if (!id) return "";
  const rows = [
    ["EAN-13", id.ean13],
    ["GTIN-14", id.gtin14],
    ["Formato", id.barcode_format],
    ["Check digit", id.check_digit_valid ? `${id.check_digit} ✓` : id.check_digit],
    ["Prefijo GS1", `${id.gs1_prefix} · ${id.gs1_member_organization || ""}`],
  ].filter(([, v]) => v);
  return `
    <div class="section">
      <h3>Identificadores</h3>
      <dl class="kv">
        ${rows.map(([k, v]) => `<dt>${k}</dt><dd><code>${v}</code></dd>`).join("")}
      </dl>
      ${id.gs1_prefix_note ? `<p style="margin-top:10px;color:var(--muted);font-size:13px">${id.gs1_prefix_note}</p>` : ""}
    </div>
  `;
}

function renderLabel(label) {
  if (!label) return "";
  const rows = Object.entries(label).map(([k, v]) => {
    const key = k.replace(/_/g, " ");
    const val = typeof v === "boolean" ? (v ? "Sí" : "No") : v;
    return `<dt>${key}</dt><dd>${val}</dd>`;
  });
  return `
    <div class="section">
      <h3>Observaciones de etiqueta</h3>
      <dl class="kv">${rows.join("")}</dl>
    </div>
  `;
}

function renderSources(sources) {
  if (!Array.isArray(sources) || !sources.length) return "";
  return `
    <div class="section sources">
      <h3>Fuentes (${sources.length})</h3>
      ${sources.map(s => `
        <details>
          <summary>${s.source_name}</summary>
          ${s.url ? `<a class="src-url" href="${s.url}" target="_blank" rel="noopener">${s.url}</a>` : ""}
          ${Array.isArray(s.facts_used) ? `<ul>${s.facts_used.map(f => `<li>${f}</li>`).join("")}</ul>` : ""}
        </details>
      `).join("")}
    </div>
  `;
}

function renderQuality(q) {
  if (!q) return "";
  return `
    <div class="section">
      <h3>Calidad de datos</h3>
      <span class="quality">Confianza: ${q.overall_confidence}</span>
      ${q.reason ? `<p style="margin-top:12px">${q.reason}</p>` : ""}
      ${Array.isArray(q.known_limitations) && q.known_limitations.length ? `
        <ul style="margin-top:8px;color:var(--muted)">${q.known_limitations.map(l => `<li>${l}</li>`).join("")}</ul>
      ` : ""}
    </div>
  `;
}

function renderCard(beer, imagePath) {
  const p = beer.normalized_product || {};
  const id = beer.identifiers || {};
  const name = p.display_name || p.name || "Cerveza";
  const brand = p.brand || "";
  return `
    <article class="card">
      <div class="card__media">
        ${imagePath
          ? `<img src="${imagePath}" alt="${name}" />`
          : `<div style="color:#000;font-size:11px;letter-spacing:.2em">SIN IMAGEN</div>`}
      </div>
      <div class="card__body">
        <div class="card__head">
          ${brand ? `<p class="brand">${brand}</p>` : ""}
          <h2>${name}</h2>
          ${id.ean13 ? `<p class="ean">EAN ${id.ean13}</p>` : ""}
        </div>
        ${renderStats(p)}
        ${renderTags(p.category)}
        ${renderProductInfo(p)}
        ${renderIngredients(beer.ingredients)}
        ${renderNutrition(beer.nutrition_per_100ml)}
        ${renderLabel(beer.image_label_observations)}
        ${renderIdentifiers(id)}
        ${renderSources(beer.source_facts)}
        ${renderQuality(beer.data_quality)}
      </div>
    </article>
  `;
}

async function main() {
  const app = document.getElementById("app");
  try {
    const manifest = await loadManifest();
    const items = await Promise.all(
      manifest.barcodes.map(async (bc) => {
        const [beer, image] = await Promise.all([loadBeer(bc), resolveImage(bc)]);
        return { beer, image, bc };
      })
    );
    app.innerHTML = items.map(({ beer, image }) => renderCard(beer, image)).join("");
  } catch (err) {
    app.innerHTML = `<div class="error">${err.message}<br/><br/>Sirve la carpeta con un servidor local:<br/><code>python3 -m http.server 8000</code></div>`;
  }
}

main();

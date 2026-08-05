/* ============================================================
   Ressonância de Schumann Hoje, lógica do painel ao vivo
   Todas as fontes são APIs públicas e gratuitas com CORS aberto.
   Sem dependências externas.
   ============================================================ */

(function () {
  "use strict";

  // ----------------------------------------------------------
  // Configuração
  // ----------------------------------------------------------
  var SRC = {
    kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    kpForecast: "https://services.swpc.noaa.gov/text/3-day-forecast.txt",
    kpForecastJson: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
    xray: "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json",
    flares: "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json",
    alerts: "https://services.swpc.noaa.gov/products/alerts.json",
    protons: "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json",
    scales: "https://services.swpc.noaa.gov/products/noaa-scales.json",
    f107: "https://services.swpc.noaa.gov/json/f107_cm_flux.json",
    ventoPlasma: "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",
    ventoMag: "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",
    quakes: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
    quakes48: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
    quakesMes: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson",
    vulcoes: "https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes&status=open&limit=100",
    // Espectrograma da estação de Tomsk (Universidade Estatal de Tomsk, Rússia).
    // Atenção: o antigo endereço sosrff.tsu.ru/new/shm.jpg deixou de ser atualizado
    // em setembro de 2025. O feed ao vivo está agora em sos70.ru.
    tomsk: "https://sos70.ru/provider.php?file=shm.jpg",
    auroraN: "https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg",
    auroraS: "https://services.swpc.noaa.gov/images/animations/ovation/south/latest.jpg",
    drap: "https://services.swpc.noaa.gov/images/animations/d-rap/global/latest.png",
    suvi: {
      "131": "https://services.swpc.noaa.gov/images/animations/suvi/primary/131/latest.png",
      "171": "https://services.swpc.noaa.gov/images/animations/suvi/primary/171/latest.png",
      "195": "https://services.swpc.noaa.gov/images/animations/suvi/primary/195/latest.png",
      "304": "https://services.swpc.noaa.gov/images/animations/suvi/primary/304/latest.png"
    }
  };

  var REFRESH_MS = 5 * 60 * 1000;   // dados numéricos: 5 minutos
  var IMG_REFRESH_MS = 60 * 1000;   // imagens: 60 segundos

  // ----------------------------------------------------------
  // Utilitários
  // ----------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function set(id, html, cls) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = html;
    if (cls) el.className = cls;
  }

  function fail(id, msg) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="err">' + (msg || "indisponível") + "</span>";
  }

  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function getText(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // Português usa vírgula decimal. Aplica-se a tudo o que é mostrado ao utilizador.
  function num(v, casas) { return Number(v).toFixed(casas === undefined ? 1 : casas).replace(".", ","); }
  function decPT(s) { return String(s).replace(".", ","); }

  function hhmm(d) { return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()); }

  // Aceita "2026-08-04 12:00:00.000" (formato NOAA) e ISO.
  function parseUTC(s) {
    if (!s) return null;
    var t = String(s).trim().replace(" ", "T");
    if (!/[Zz]$/.test(t) && !/[+-]\d\d:\d\d$/.test(t)) t += "Z";
    var d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }

  function ago(date) {
    if (!date) return "…";
    var m = Math.round((Date.now() - date.getTime()) / 60000);
    if (m < 1) return "agora mesmo";
    if (m < 60) return "há " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "há " + h + " h";
    var d = Math.round(h / 24);
    return "há " + d + (d === 1 ? " dia" : " dias");
  }

  // Alguns feeds da NOAA vêm do mais recente para o mais antigo e outros ao
  // contrário. Em vez de assumir a ordem, escolhe-se sempre o registo com a
  // marca temporal mais recente.
  function maisRecente(rows, campoTempo) {
    var melhor = null, tMelhor = -Infinity;
    rows.forEach(function (r) {
      var t = parseUTC(r[campoTempo || "time_tag"]);
      if (t && t.getTime() > tMelhor) { tMelhor = t.getTime(); melhor = r; }
    });
    return melhor;
  }

  function fmtDatePT(d) {
    try {
      return new Intl.DateTimeFormat("pt-PT", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      }).format(d);
    } catch (e) {
      return d.toLocaleDateString();
    }
  }

  // ----------------------------------------------------------
  // Escalas de interpretação
  // ----------------------------------------------------------

  // Kp 0–9 → rótulo, classe de cor e escala de tempestade G
  function kpInfo(kp) {
    if (kp < 2)  return { label: "Muito calmo",    cls: "is-calm",   g: "…",  desc: "Campo geomagnético quase sem perturbação." };
    if (kp < 3)  return { label: "Calmo",          cls: "is-calm",   g: "…",  desc: "Condições estáveis, sem atividade relevante." };
    if (kp < 4)  return { label: "Instável",       cls: "is-mild",   g: "…",  desc: "Ligeiras oscilações no campo magnético terrestre." };
    if (kp < 5)  return { label: "Ativo",          cls: "is-active", g: "…",  desc: "Campo agitado, ainda abaixo do limiar de tempestade." };
    if (kp < 6)  return { label: "Tempestade G1",  cls: "is-active", g: "G1", desc: "Tempestade geomagnética menor em curso." };
    if (kp < 7)  return { label: "Tempestade G2",  cls: "is-storm",  g: "G2", desc: "Tempestade moderada. Auroras em latitudes médias." };
    if (kp < 8)  return { label: "Tempestade G3",  cls: "is-storm",  g: "G3", desc: "Tempestade forte. Possíveis falhas de GPS e rádio." };
    if (kp < 9)  return { label: "Tempestade G4",  cls: "is-severe", g: "G4", desc: "Tempestade severa. Impacto em redes elétricas." };
    return         { label: "Tempestade G5",  cls: "is-severe", g: "G5", desc: "Tempestade extrema. Evento raro e de grande escala." };
  }

  // Fluxo de raios-X (W/m²) → classe A/B/C/M/X
  function xrayClass(flux) {
    if (!(flux > 0)) return { txt: "…", cls: "is-calm", level: 0 };
    var bands = [
      { min: 1e-4, letter: "X", cls: "is-severe", level: 4 },
      { min: 1e-5, letter: "M", cls: "is-storm",  level: 3 },
      { min: 1e-6, letter: "C", cls: "is-active", level: 2 },
      { min: 1e-7, letter: "B", cls: "is-mild",   level: 1 },
      { min: 0,    letter: "A", cls: "is-calm",   level: 0 }
    ];
    for (var i = 0; i < bands.length; i++) {
      if (flux >= bands[i].min) {
        var mult = bands[i].min > 0 ? flux / bands[i].min : flux / 1e-8;
        return {
          txt: bands[i].letter + num(mult),
          cls: bands[i].cls,
          level: bands[i].level
        };
      }
    }
    return { txt: "…", cls: "is-calm", level: 0 };
  }

  // ----------------------------------------------------------
  // Estado partilhado para o índice composto
  // ----------------------------------------------------------
  var state = { kp: null, xrayLevel: null, quakeMax: null, quakeCount: null };

  // ----------------------------------------------------------
  // Monitor de frescura das fontes
  // Regista, para cada fonte, se a última tentativa correu bem e quando.
  // É isto que evita publicar dados velhos como se fossem de agora.
  // ----------------------------------------------------------
  var SOURCES = [
    { id: "spectro", nome: "Espectrograma (SOS Tomsk)", cadencia: "origem renova a cada ~20 min" },
    { id: "kp",      nome: "Índice Kp (NOAA)",          cadencia: "origem renova a cada 3 h" },
    { id: "xray",    nome: "Raios-X solares (GOES)",    cadencia: "origem renova a cada minuto" },
    { id: "protons", nome: "Fluxo de protões (GOES)",   cadencia: "origem renova a cada 5 min" },
    { id: "vento",   nome: "Vento solar (ACE/DSCOVR)",  cadencia: "origem renova a cada minuto" },
    { id: "quakes",  nome: "Sismos (USGS)",             cadencia: "origem renova a cada minuto" },
    { id: "vulcoes", nome: "Vulcões ativos (NASA EONET)", cadencia: "origem renova diariamente" },
    { id: "alerts",  nome: "Alertas (NOAA)",            cadencia: "só quando há alertas" },
    { id: "forecast",nome: "Previsão 3 dias (NOAA)",    cadencia: "3 boletins por dia" }
  ];
  var health = {};

  function mark(id, ok) {
    health[id] = { ok: ok, at: new Date() };
    renderHealth();
  }

  function renderHealth() {
    var host = document.getElementById("health-list");
    if (!host) return;
    host.innerHTML = SOURCES.map(function (s) {
      var h = health[s.id];
      var cor, txt;
      if (!h)          { cor = "var(--text-faint)"; txt = "a contactar…"; }
      else if (!h.ok)  { cor = "var(--red)";        txt = "sem resposta"; }
      else             { cor = "var(--green)";      txt = "recebido " + ago(h.at); }
      return '<li><span class="dot" style="background:' + cor + ';color:' + cor + '"></span>' +
             '<span>' + s.nome + '</span>' +
             '<span class="v" style="font-weight:400;color:var(--text-faint);font-size:12px">' +
             txt + " · " + s.cadencia + "</span></li>";
    }).join("");
  }

  /**
   * Índice de Energia da Terra (0–100).
   * Combinação ponderada e transparente de três indicadores públicos:
   *   60% atividade geomagnética (Kp), 25% atividade solar (raios-X),
   *   15% atividade sísmica (nº e magnitude de sismos M4.5+ em 24 h).
   * Não é uma medida científica padronizada, é um resumo editorial.
   * A fórmula está documentada em /metodologia.html.
   */
  function computeIndex() {
    if (state.kp === null) return;

    var geo = Math.min(state.kp / 9, 1) * 60;

    var solar = 0;
    if (state.xrayLevel !== null) solar = (state.xrayLevel / 4) * 25;

    var seis = 0;
    if (state.quakeCount !== null) {
      var byCount = Math.min(state.quakeCount / 25, 1);
      var byMag = state.quakeMax ? Math.min(Math.max(state.quakeMax - 4.5, 0) / 3, 1) : 0;
      seis = (byCount * 0.5 + byMag * 0.5) * 15;
    }

    var score = Math.round(geo + solar + seis);
    score = Math.max(0, Math.min(100, score));

    var band;
    if (score < 20)      band = { word: "Calmo",       cls: "is-calm",   titulo: "Campo tranquilo, dia sem sobressaltos",        txt: "A Terra está num dos seus dias mais tranquilos. Campo geomagnético estável e Sol pouco ativo." };
    else if (score < 40) band = { word: "Suave",       cls: "is-mild",   titulo: "Ligeira agitação, nada de relevante",           txt: "Atividade ligeira. Pequenas variações no campo magnético, sem impacto tecnológico esperado." };
    else if (score < 60) band = { word: "Agitado",     cls: "is-active", titulo: "Campo geomagnético em movimento",               txt: "Campo geomagnético em movimento. Auroras possíveis em latitudes altas." };
    else if (score < 80) band = { word: "Turbulento",  cls: "is-storm",  titulo: "Tempestade geomagnética em curso",              txt: "Tempestade geomagnética em curso. Possíveis interferências em GPS e comunicações rádio." };
    else                 band = { word: "Extremo",     cls: "is-severe", titulo: "Condições extremas, alertas ativos",            txt: "Condições raras e intensas. Alertas ativos da NOAA para infraestruturas." };

    resumo.energia = score;
    resumo.palavra = band.word;
    resumo.cls = band.cls;
    resumo.titulo = band.titulo;

    drawGauge(score, band.cls);
    set("idx-value", String(score), "gauge-value " + band.cls);
    set("idx-word", band.word, "gauge-unit " + band.cls);
    set("t-energy", String(score), band.cls);
    set("t-energy-word", band.word, "tile-sub " + band.cls);
    var dt = $("#daily-text");
    if (dt) dt.textContent = band.txt;
    renderInsight();
    renderNowSummary();
  }

  var COR = {
    "is-calm": "#34d399", "is-mild": "#38bdf8", "is-active": "#fbbf24",
    "is-storm": "#fb923c", "is-severe": "#f43f5e"
  };

  // Medidor circular em SVG, com coroa de marcas (sem bibliotecas)
  function drawGauge(score, cls) {
    var host = document.getElementById("gauge-svg");
    if (!host) return;
    var R = 82, C = 2 * Math.PI * R, off = C * (1 - score / 100);
    var color = COR[cls] || "#8b5cf6";

    // 48 marcas radiais; as que já foram "percorridas" ficam acesas
    var ticks = "", N = 48;
    for (var i = 0; i < N; i++) {
      var ang = (i / N) * 2 * Math.PI - Math.PI / 2;
      var aceso = (i / N) * 100 <= score;
      var r1 = 62, r2 = 68;
      ticks += '<line x1="' + (100 + r1 * Math.cos(ang)).toFixed(1) + '" y1="' + (100 + r1 * Math.sin(ang)).toFixed(1) +
               '" x2="' + (100 + r2 * Math.cos(ang)).toFixed(1) + '" y2="' + (100 + r2 * Math.sin(ang)).toFixed(1) +
               '" stroke="' + (aceso ? color : "rgba(255,255,255,.09)") + '" stroke-width="2" stroke-linecap="round"' +
               (aceso ? ' opacity=".55"' : "") + "/>";
    }

    host.innerHTML =
      '<svg viewBox="0 0 200 200" role="img" aria-label="Índice de Energia da Terra: ' + score + ' em 100">' +
        '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="9"/>' +
        ticks +
        '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="' + color + '" stroke-width="9" ' +
          'stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" ' +
          'transform="rotate(-90 100 100)" style="transition:stroke-dashoffset .9s ease;filter:drop-shadow(0 0 8px ' + color + '88)"/>' +
      "</svg>";
  }

  // ----------------------------------------------------------
  // Gráficos SVG simples
  // ----------------------------------------------------------

  function barChart(hostId, points, opts) {
    var host = document.getElementById(hostId);
    if (!host) return;
    opts = opts || {};
    var W = 900, H = 240, padL = 34, padB = 30, padT = 12, padR = 10;
    var max = opts.max || Math.max.apply(null, points.map(function (p) { return p.v; })).toFixed(0);
    max = Math.max(Number(max), 1);
    var iw = W - padL - padR, ih = H - padB - padT;
    var bw = iw / points.length;
    var s = "";

    // grelha horizontal
    for (var g = 0; g <= max; g += opts.step || 1) {
      var y = padT + ih - (g / max) * ih;
      s += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) +
           '" stroke="rgba(255,255,255,.07)" stroke-width="1"/>';
      s += '<text x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" fill="#6b7391" font-size="11" text-anchor="end">' + g + "</text>";
    }

    points.forEach(function (p, i) {
      var h = Math.max((p.v / max) * ih, 2);
      var x = padL + i * bw + bw * 0.16;
      var y = padT + ih - h;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.68).toFixed(1) +
           '" height="' + h.toFixed(1) + '" rx="3" fill="' + p.color + '"><title>' + p.label + "</title></rect>";
      if (p.tick) {
        s += '<text x="' + (padL + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 9) +
             '" fill="#6b7391" font-size="10" text-anchor="middle">' + p.tick + "</text>";
      }
    });

    host.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' + s + "</svg>";
  }

  function lineChartLog(hostId, series, opts) {
    var host = document.getElementById(hostId);
    if (!host) return;
    opts = opts || {};
    var W = 900, H = 240, padL = 42, padB = 26, padT = 12, padR = 10;
    var iw = W - padL - padR, ih = H - padB - padT;
    var loMin = opts.minExp !== undefined ? opts.minExp : -9;
    var loMax = opts.maxExp !== undefined ? opts.maxExp : -3;
    var s = "";
    var letters = opts.rotulos || { "-8": "A", "-7": "B", "-6": "C", "-5": "M", "-4": "X" };

    for (var e = loMin + 1; e <= loMax; e++) {
      var y = padT + ih - ((e - loMin) / (loMax - loMin)) * ih;
      s += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) +
           '" stroke="rgba(255,255,255,.07)"/>';
      if (letters[String(e)]) {
        s += '<text x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" fill="#6b7391" font-size="11" text-anchor="end">' +
             letters[String(e)] + "</text>";
      }
    }

    var n = series.length;
    var piso = Math.pow(10, loMin);
    var d = series.map(function (p, i) {
      var x = padL + (i / Math.max(n - 1, 1)) * iw;
      var ex = Math.log(Math.max(p, piso)) / Math.LN10;
      ex = Math.max(loMin, Math.min(loMax, ex));
      var y = padT + ih - ((ex - loMin) / (loMax - loMin)) * ih;
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");

    s += '<path d="' + d + '" fill="none" stroke="' + (opts.cor || "#38bdf8") + '" stroke-width="2" stroke-linejoin="round"/>';
    host.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' + s + "</svg>";
  }

  // ----------------------------------------------------------
  // Carregamento de dados
  // ----------------------------------------------------------

  function loadKp() {
    return getJSON(SRC.kp).then(function (rows) {
      // Formato: array de objetos {time_tag, Kp, ...} ou array de arrays com cabeçalho.
      var data = [];
      if (Array.isArray(rows[0])) {
        var head = rows[0];
        var iT = head.indexOf("time_tag"), iK = head.indexOf("Kp");
        rows.slice(1).forEach(function (r) { data.push({ t: parseUTC(r[iT]), v: Number(r[iK]) }); });
      } else {
        rows.forEach(function (r) { data.push({ t: parseUTC(r.time_tag), v: Number(r.Kp) }); });
      }
      data = data.filter(function (d) { return d.t && isFinite(d.v); });
      if (!data.length) throw new Error("sem dados");

      var last = data[data.length - 1];
      var info = kpInfo(last.v);
      state.kp = last.v;

      set("kp-value", num(last.v), "metric-kp " + info.cls);
      set("kp-label", info.label);
      set("kp-desc", info.desc);
      set("kp-time", "Atualizado " + ago(last.t) + " · " + hhmm(last.t) + " UTC");
      set("kp-storm", info.g === "…" ? "sem tempestade" : "escala " + info.g);
      set("t-kp", num(last.v), info.cls);
      set("t-kp-sub", info.g === "…" ? info.label : info.label + " · " + info.g);

      var recent = data.slice(-24);
      barChart("kp-chart", recent.map(function (d, i) {
        var c = COR[kpInfo(d.v).cls];
        return {
          v: Number(d.v.toFixed(2)),
          color: c,
          label: hhmm(d.t) + " UTC · Kp " + num(d.v),
          tick: i % 4 === 0 ? hhmm(d.t) : null
        };
      }), { max: 9, step: 3 });

      computeIndex();
      renderSpectroCaption();
      mark("kp", true);
    }).catch(function (e) {
      fail("kp-value"); fail("kp-label", "dados indisponíveis");
      mark("kp", false);
      console.warn("Kp:", e);
    });
  }

  function loadXray() {
    return getJSON(SRC.xray).then(function (rows) {
      var long = rows.filter(function (r) { return r.energy === "0.1-0.8nm"; });
      if (!long.length) throw new Error("sem dados");
      var last = long[long.length - 1];
      var info = xrayClass(last.flux);
      state.xrayLevel = info.level;

      set("xray-value", info.txt, info.cls);
      set("xray-time", "Satélite GOES · " + ago(parseUTC(last.time_tag)));
      set("t-xray", info.txt, info.cls);
      resumo.xray = info.txt;
      renderNowSummary();

      lineChartLog("xray-chart", long.slice(-720).map(function (r) { return r.flux; }));
      computeIndex();
      mark("xray", true);
    }).catch(function (e) {
      fail("xray-value");
      mark("xray", false);
      console.warn("Raios-X:", e);
    });
  }

  function loadFlares() {
    return getJSON(SRC.flares).then(function (rows) {
      var host = document.getElementById("flare-list");
      if (!host) return;
      if (!rows || !rows.length) {
        host.innerHTML = '<li class="muted">Sem erupções registadas nos últimos 7 dias.</li>';
        set("t-flare", "…"); set("t-flare-sub", "nenhuma em 7 dias");
        return;
      }

      var ultima = rows[rows.length - 1];
      var tu = parseUTC(ultima.max_time || ultima.begin_time);
      var clsU = /^X/.test(ultima.max_class) ? "is-severe" : /^M/.test(ultima.max_class) ? "is-storm"
               : /^C/.test(ultima.max_class) ? "is-active" : "is-mild";
      set("t-flare", ultima.max_class ? decPT(ultima.max_class) : "…", clsU);
      set("t-flare-sub", tu ? ago(tu) : "…");
      resumo.flare = ultima.max_class ? decPT(ultima.max_class) : null;
      resumo.flareQuando = tu ? ago(tu) : "";
      renderNowSummary();

      var items = rows.slice(-8).reverse().map(function (f) {
        var t = parseUTC(f.max_time || f.begin_time);
        var cls = /^X/.test(f.max_class) ? "is-severe" : /^M/.test(f.max_class) ? "is-storm" : /^C/.test(f.max_class) ? "is-active" : "is-mild";
        return '<li><span class="k">' + (t ? pad(t.getUTCDate()) + "/" + pad(t.getUTCMonth() + 1) + " " + hhmm(t) : "…") +
               '</span><span>Erupção solar</span><span class="v ' + cls + '">' + (f.max_class ? decPT(f.max_class) : "…") + "</span></li>";
      }).join("");
      host.innerHTML = items;
    }).catch(function (e) {
      var host = document.getElementById("flare-list");
      if (host) host.innerHTML = '<li class="err">Lista de erupções indisponível.</li>';
      console.warn("Erupções:", e);
    });
  }

  function loadQuakes() {
    return getJSON(SRC.quakes).then(function (geo) {
      var feats = (geo.features || []).filter(function (f) {
        return Date.now() - f.properties.time < 24 * 3600 * 1000;
      });
      var mags = feats.map(function (f) { return f.properties.mag; });
      var max = mags.length ? Math.max.apply(null, mags) : 0;

      state.quakeCount = feats.length;
      state.quakeMax = max;

      set("quake-count", String(feats.length));
      set("quake-max", max ? num(max) : "…");
      set("t-quakes", String(feats.length), feats.length ? "is-mild" : "is-calm");
      set("t-quakes-sub", max ? "máx. M" + num(max) : "nenhum registado");

      resumo.sismos = feats.length;
      resumo.sismoMax = max || null;
      renderNowSummary();
      loadQuakesMes();

      var host = document.getElementById("quake-list");
      if (host) {
        if (!feats.length) {
          host.innerHTML = '<li class="muted">Nenhum sismo de magnitude 4,5+ nas últimas 24 horas.</li>';
        } else {
          host.innerHTML = feats.sort(function (a, b) { return b.properties.mag - a.properties.mag; })
            .slice(0, 6).map(function (f) {
              var p = f.properties;
              var cls = p.mag >= 6.5 ? "is-severe" : p.mag >= 5.5 ? "is-storm" : "is-active";
              return '<li><span class="k">' + ago(new Date(p.time)) + '</span><span>' +
                     escapeHTML(traduzLocal(p.place)) + '</span><span class="v ' + cls + '">M' + num(p.mag) + "</span></li>";
            }).join("");
        }
      }
      computeIndex();
      mark("quakes", true);
    }).catch(function (e) {
      fail("quake-count");
      mark("quakes", false);
      console.warn("Sismos:", e);
    });
  }

  function loadForecast() {
    return getText(SRC.kpForecast).then(function (txt) {
      var host = document.getElementById("forecast-raw");
      if (host) host.textContent = txt.trim();
      mark("forecast", true);
    }).catch(function (e) {
      var host = document.getElementById("forecast-raw");
      if (host) host.innerHTML = '<span class="err">Previsão indisponível de momento.</span>';
      mark("forecast", false);
      console.warn("Previsão:", e);
    });
  }

  // Frase de previsão: pico de Kp esperado nas próximas 24 horas.
  function loadKpForecastLine() {
    return getJSON(SRC.kpForecastJson).then(function (rows) {
      var el = document.getElementById("forecast-line");
      if (!el) return;

      var futuros = [];
      rows.forEach(function (r) {
        // Suporta tanto o formato de objetos como o de array com cabeçalho.
        var t = parseUTC(r.time_tag || r[0]);
        var v = Number(r.kp !== undefined ? r.kp : r[1]);
        var obs = String(r.observed !== undefined ? r.observed : r[2] || "");
        if (t && isFinite(v) && t.getTime() > Date.now() && /pred/i.test(obs)) {
          futuros.push({ t: t, v: v });
        }
      });
      // Janela das próximas 24 horas
      futuros = futuros.filter(function (f) { return f.t.getTime() - Date.now() < 24 * 3600 * 1000; });
      if (!futuros.length) { el.textContent = "Sem previsão de Kp disponível para as próximas 24 horas."; return; }

      var pico = futuros.reduce(function (a, b) { return b.v > a.v ? b : a; });
      var info = kpInfo(pico.v);
      var fim = new Date(pico.t.getTime() + 3 * 3600 * 1000);

      el.innerHTML = "<b>Previsão geomagnética:</b> Kp máximo esperado de <b>" + num(pico.v) +
        "</b> (" + info.label.toLowerCase() + ") entre as " + hhmm(pico.t) + " e as " + hhmm(fim) +
        " UTC, fonte NOAA SWPC.";
    }).catch(function (e) {
      var el = document.getElementById("forecast-line");
      if (el) el.innerHTML = '<span class="err">Previsão de Kp indisponível de momento.</span>';
      console.warn("Previsão Kp:", e);
    });
  }

  function loadAlerts() {
    return getJSON(SRC.alerts).then(function (rows) {
      var host = document.getElementById("alert-list");
      if (!host) return;
      var recent = rows.filter(function (r) {
        var d = parseUTC(r.issue_datetime);
        return d && Date.now() - d.getTime() < 72 * 3600 * 1000;
      }).slice(0, 5);

      mark("alerts", true);
      if (!recent.length) {
        host.innerHTML = '<li class="muted">Nenhum alerta emitido nas últimas 72 horas. Condições dentro do normal.</li>';
        return;
      }
      host.innerHTML = recent.map(function (r) {
        var d = parseUTC(r.issue_datetime);
        var first = String(r.message || "").split("\n").filter(function (l) { return l.trim(); })[0] || "Alerta NOAA";
        return '<li><span class="k">' + (d ? pad(d.getUTCDate()) + "/" + pad(d.getUTCMonth() + 1) : "…") +
               '</span><span>' + escapeHTML(first.replace(/^(Space Weather Message Code|ALERT|WARNING|WATCH)[:\s]*/i, "")) + "</span></li>";
      }).join("");
    }).catch(function (e) {
      var host = document.getElementById("alert-list");
      if (host) host.innerHTML = '<li class="err">Alertas indisponíveis.</li>';
      mark("alerts", false);
      console.warn("Alertas:", e);
    });
  }

  // ----------------------------------------------------------
  // Tradução dos nomes de local do USGS e da NASA
  //
  // Vêm sempre em inglês e com um formato previsível
  // ("128 km SSE of Kokopo, Papua New Guinea"). Traduz-se a parte
  // padronizada e os países mais frequentes; o topónimo em si fica intacto,
  // que é o correto: nomes próprios não se traduzem.
  // ----------------------------------------------------------

  var PAISES = {
    "Japan": "Japão", "Philippines": "Filipinas", "Indonesia": "Indonésia",
    "Russia": "Rússia", "Mexico": "México", "New Zealand": "Nova Zelândia",
    "Papua New Guinea": "Papua-Nova Guiné", "Alaska": "Alasca", "Greece": "Grécia",
    "Turkey": "Turquia", "Italy": "Itália", "Colombia": "Colômbia", "Ecuador": "Equador",
    "Nicaragua": "Nicarágua", "Solomon Islands": "Ilhas Salomão", "India": "Índia",
    "Iran": "Irão", "Afghanistan": "Afeganistão", "Pakistan": "Paquistão",
    "United States": "Estados Unidos", "Canada": "Canadá", "Spain": "Espanha",
    "Azores": "Açores", "Chile": "Chile", "Peru": "Peru", "China": "China",
    "Taiwan": "Taiwan", "Fiji": "Fiji", "Tonga": "Tonga", "Vanuatu": "Vanuatu",
    "Guatemala": "Guatemala", "El Salvador": "Salvador", "Costa Rica": "Costa Rica",
    "Argentina": "Argentina", "Bolivia": "Bolívia", "Panama": "Panamá",
    "Dominican Republic": "República Dominicana", "Puerto Rico": "Porto Rico",
    "Antarctica": "Antártida", "Iceland": "Islândia", "Norway": "Noruega",
    "Morocco": "Marrocos", "Algeria": "Argélia", "Ethiopia": "Etiópia",
    "Myanmar": "Mianmar", "Malaysia": "Malásia", "Nepal": "Nepal", "Cyprus": "Chipre"
  };

  var RUMOS = {
    N: "N", S: "S", E: "E", W: "O",
    NE: "NE", NW: "NO", SE: "SE", SW: "SO",
    NNE: "NNE", NNW: "NNO", ENE: "ENE", ESE: "ESE",
    SSE: "SSE", SSW: "SSO", WNW: "ONO", WSW: "OSO"
  };

  function traduzLocal(s) {
    if (!s) return "Local desconhecido";
    var t = " " + String(s) + " ";

    // "128 km SSE of Kokopo" -> "128 km a SSE de Kokopo"
    t = t.replace(/(\d+)\s*km\s+([NSEW]{1,3})\s+of\s+/gi, function (_, d, r) {
      var k = RUMOS[r.toUpperCase()] || r.toUpperCase();
      return d + " km a " + k + " de ";
    });

    t = t.replace(/\boff the (west|east|north|south) coast of\b/gi, function (_, d) {
      var m = { west: "oeste", east: "este", north: "norte", south: "sul" };
      return "ao largo da costa " + m[d.toLowerCase()] + " de";
    });
    t = t.replace(/\boff the coast of\b/gi, "ao largo da costa de");
    t = t.replace(/\bsouth of the\b/gi, "a sul das").replace(/\bsouth of\b/gi, "a sul de");
    t = t.replace(/\bnorth of the\b/gi, "a norte das").replace(/\bnorth of\b/gi, "a norte de");
    t = t.replace(/\beast of the\b/gi, "a este das").replace(/\beast of\b/gi, "a este de");
    t = t.replace(/\bwest of the\b/gi, "a oeste das").replace(/\bwest of\b/gi, "a oeste de");
    t = t.replace(/\bregion\b/gi, "região de");

    // Em português o genérico vem antes do nome: "Kermadec Islands" -> "Ilhas Kermadec".
    t = t.replace(/\b([A-Z][\wÀ-ÿ'-]*(?:\s+[A-Z][\wÀ-ÿ'-]*)?)\s+Islands\b/g, "Ilhas $1");
    t = t.replace(/\b([A-Z][\wÀ-ÿ'-]*(?:\s+[A-Z][\wÀ-ÿ'-]*)?)\s+Island\b/g, "Ilha $1");

    // "New Mexico" antes de "Mexico", senão fica "New México".
    t = t.replace(/\bNew Mexico\b/g, "Novo México");

    Object.keys(PAISES).forEach(function (en) {
      t = t.replace(new RegExp("\\b" + en + "\\b", "g"), PAISES[en]);
    });

    // "Ilhas Auckland, Nova Zelândia região de" -> "... (região)"
    t = t.replace(/,?\s*região de\s*$/i, " (região)");
    return t.replace(/\s+/g, " ").trim();
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ----------------------------------------------------------
  // Idade real dos dados do espectrograma
  //
  // A estação não publica cabeçalho Last-Modified, por isso a idade é lida
  // da própria imagem: o gráfico cobre exatamente 72 horas e a zona sem
  // dados fica preta. Encontrando a última coluna com sinal, sabe-se até
  // que hora a estação registou.
  //
  // O eixo está em UTC, verificável pelo facto de o último painel datado
  // corresponder sempre à data UTC corrente, e não à data local de Tomsk
  // (UTC+7), que já virou o dia. Ver metodologia.html.
  //
  // A leitura de píxeis exige CORS, que a estação não envia; por isso a
  // análise usa um proxy de imagem. Se o proxy falhar, o painel continua a
  // funcionar, apenas não mostra a idade. A imagem visível vem sempre
  // diretamente da estação, sem intermediários.
  // ----------------------------------------------------------

  var SPECTRO_PROXY = "https://images.weserv.nl/?url=" +
    encodeURIComponent("sos70.ru/provider.php?file=shm.jpg") + "&n=-1";
  var SPAN_H = 72;              // horas cobertas pela imagem
  var ATRASO_ALERTA_H = 4;      // acima disto, mostra aviso de atraso

  function probeSpectroAge() {
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = function () { renderSpectroAge(null); };
    img.onload = function () {
      try { renderSpectroAge(readLastSample(img)); }
      catch (e) { renderSpectroAge(null); console.warn("Idade do espectrograma:", e); }
    };
    img.src = SPECTRO_PROXY + "&_=" + Date.now();
  }

  function readLastSample(img) {
    var W = img.naturalWidth, H = img.naturalHeight;
    if (!W || !H) return null;

    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    var px = g.getImageData(0, 0, W, H).data;

    // Limites do gráfico: dados pela linha branca horizontal mais longa do terço
    // inferior, o eixo dos tempos. Não se pode usar colunas brancas para isto,
    // porque as plumas de sinal saturado também ocupam a coluna toda.
    var esq = -1, dir = -1, melhor = 0;
    for (var y = Math.round(H * 0.85); y < Math.round(H * 0.99); y++) {
      var run = 0, ini = 0;
      for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 4;
        if ((px[i] + px[i + 1] + px[i + 2]) / 3 > 200) {
          if (run === 0) ini = x;
          run++;
          if (run > melhor) { melhor = run; esq = ini; dir = x; }
        } else run = 0;
      }
    }
    if (esq < 0 || dir - esq < W * 0.5) return null;

    // Brilho médio de cada coluna, na faixa vertical do gráfico.
    var y0 = Math.round(H * 0.14), y1 = Math.round(H * 0.92);
    var media = new Float32Array(W);
    for (var x2 = esq; x2 <= dir; x2++) {
      var soma = 0, n = 0;
      for (var y2 = y0; y2 < y1; y2 += 2) {
        var j = (y2 * W + x2) * 4;
        soma += (px[j] + px[j + 1] + px[j + 2]) / 3;
        n++;
      }
      media[x2] = soma / n;
    }

    // Limiar adaptativo: as colunas com sinal são muito mais claras do que a
    // zona sem dados. Um limiar fixo falharia se a estação mudasse a paleta.
    var pico = 0;
    for (var x3 = esq + 3; x3 < dir - 3; x3++) if (media[x3] > pico) pico = media[x3];
    if (pico < 30) return null;
    var limiar = pico * 0.25;

    // Última coluna com sinal: exige três colunas seguidas acima do limiar,
    // para não confundir um artefacto isolado com dados reais.
    var fim = -1;
    for (var x4 = dir - 4; x4 > esq + 2; x4--) {
      if (media[x4] > limiar && media[x4 - 1] > limiar && media[x4 - 2] > limiar) { fim = x4; break; }
    }
    if (fim < 0) return null;

    // Devolve apenas a fração da janela de 72 h que está preenchida com dados.
    // Não se converte isto numa hora UTC absoluta: as datas do gráfico são
    // texto desenhado na imagem, e quando a estação atrasa, o último painel
    // deixa de ser o dia de hoje. Assumir o contrário dava um erro de 24 h.
    return (fim - esq) / (dir - esq);
  }

  // Deteção de estagnação: guarda a posição da frente de dados entre visitas.
  // Se a frente não avança enquanto o relógio avança, a estação parou.
  var BORDA_KEY = "rs_borda_v1";

  function registaBorda(frac) {
    var agora = Date.now(), guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(BORDA_KEY)); } catch (e) {}

    var novo;
    if (guardado && Math.abs(guardado.frac - frac) < 0.002) {
      novo = { frac: frac, desde: guardado.desde, visto: agora };   // mesma frente
    } else {
      novo = { frac: frac, desde: agora, visto: agora };            // avançou
    }
    try { localStorage.setItem(BORDA_KEY, JSON.stringify(novo)); } catch (e) {}
    return novo;
  }

  function horasMinutos(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    var h = Math.floor(m / 60);
    m = m % 60;
    if (h === 0) return m + " min";
    if (m === 0) return h + " h";
    return h + " h " + m + " min";
  }

  function renderSpectroAge(ultimo) {
    var el = document.getElementById("spectro-updated");
    var aviso = document.getElementById("spectro-delay");
    var avisoTxt = document.getElementById("spectro-delay-text");

    if (!ultimo) {
      if (el) el.textContent = "imagem relida às " + hhmm(new Date()) + " UTC";
      if (aviso) aviso.hidden = true;
      return;
    }

    var frac = ultimo;
    var preenchidas = frac * SPAN_H;       // horas já registadas
    var vazias = SPAN_H - preenchidas;     // faixa preta à direita
    var b = registaBorda(frac);
    var paradaMs = Date.now() - b.desde;

    resumo.espectro = num(preenchidas, 0) + " h de 72 h preenchidas";
    renderNowSummary();

    if (el) {
      el.textContent = "janela de 3 dias: " + num(preenchidas, 0) + " h registadas, " +
        num(vazias, 0) + " h ainda por registar";
    }

    if (aviso && avisoTxt) {
      // Só se afirma atraso quando é demonstrável: ou a frente de dados não se
      // move há horas, ou falta mais de um dia inteiro para encher a janela.
      if (paradaMs > 2 * 3600 * 1000) {
        avisoTxt.innerHTML = "<b>A estação de Tomsk não publica dados novos há " +
          horasMinutos(paradaMs) + ".</b> A faixa preta à direita é tempo por registar, " +
          "não uma alteração do fenómeno. As datas impressas no topo da imagem mostram " +
          "até que dia a estação chegou.";
        aviso.hidden = false;
      } else if (vazias > 24) {
        avisoTxt.innerHTML = "<b>Estação de Tomsk atrasada.</b> Faltam " + num(vazias, 0) +
          " h para preencher a janela de 3 dias, mais do que um dia inteiro. " +
          "Confirme as datas impressas no topo da imagem.";
        aviso.hidden = false;
      } else {
        aviso.hidden = true;
      }
    }
  }

  // Frase-resumo por baixo do espectrograma
  function renderSpectroCaption() {
    var el = document.getElementById("spectro-caption");
    if (!el) return;
    if (state.kp === null) return;
    var info = kpInfo(state.kp);
    el.innerHTML =
      "Neste momento a frequência fundamental da Ressonância de Schumann situa-se em torno de " +
      "<b>7,83&nbsp;Hz</b> e o campo geomagnético está em estado <b>" + info.label.toLowerCase() +
      "</b> (Kp&nbsp;" + num(state.kp) + "). Em direto da estação da Universidade Estatal " +
      "de Tomsk, relido a cada minuto.";
  }

  // ----------------------------------------------------------
  // Fluxo de protões (partículas energéticas solares) e escala S
  // ----------------------------------------------------------

  function escalaS(pfu) {
    if (pfu >= 1e5) return { s: "S5", txt: "Extrema", cls: "is-severe" };
    if (pfu >= 1e4) return { s: "S4", txt: "Severa", cls: "is-severe" };
    if (pfu >= 1e3) return { s: "S3", txt: "Forte", cls: "is-storm" };
    if (pfu >= 100) return { s: "S2", txt: "Moderada", cls: "is-storm" };
    if (pfu >= 10)  return { s: "S1", txt: "Menor", cls: "is-active" };
    return { s: "S0", txt: "Normal", cls: "is-calm" };
  }

  function loadProtons() {
    return getJSON(SRC.protons).then(function (rows) {
      var serie = rows.filter(function (r) { return r.energy === ">=10 MeV"; });
      if (!serie.length) throw new Error("sem dados");
      var last = serie[serie.length - 1];
      var e = escalaS(last.flux);

      set("proton-value", num(last.flux, 2) + " pfu", e.cls);
      set("proton-scale", e.s + ", " + e.txt, e.cls);
      resumo.protao = e.s + " (" + e.txt.toLowerCase() + ")";
      renderNowSummary();
      set("proton-time", "Satélite GOES · " + ago(parseUTC(last.time_tag)));

      lineChartLog("proton-chart", serie.slice(-720).map(function (r) { return r.flux; }), {
        minExp: -2, maxExp: 4,
        rotulos: { "1": "10", "2": "100", "3": "1k", "4": "10k" }
      });
      mark("protons", true);
    }).catch(function (e) {
      fail("proton-value");
      mark("protons", false);
      console.warn("Protões:", e);
    });
  }

  function loadF107() {
    return getJSON(SRC.f107).then(function (rows) {
      if (!rows || !rows.length) throw new Error("sem dados");
      var last = rows[0];   // este feed vem por ordem decrescente
      rows.forEach(function (r) {
        var a = parseUTC(r.time_tag), b = parseUTC(last.time_tag);
        if (a && b && a > b) last = r;
      });
      set("f107-value", num(last.flux, 0) + " sfu");
      set("f107-time", "Medição de " + ago(parseUTC(last.time_tag)));
    }).catch(function (e) {
      fail("f107-value");
      console.warn("F10.7:", e);
    });
  }

  // ----------------------------------------------------------
  // Vento solar: velocidade, densidade e campo magnético interplanetário.
  //
  // O Bz é o valor que realmente antecipa tempestades: quando aponta para sul
  // (negativo), o campo do vento solar liga-se ao da Terra e a energia entra.
  // Um Bz muito negativo é o melhor aviso prévio que existe, com cerca de
  // 15 a 60 minutos de antecedência.
  // ----------------------------------------------------------

  function loadVentoSolar() {
    var p1 = getJSON(SRC.ventoPlasma).then(function (rows) {
      var bons = rows.filter(function (r) { return r.proton_speed > 0; });
      if (!bons.length) throw new Error("sem dados");
      var last = maisRecente(bons);

      var vel = last.proton_speed;
      var clsV = vel >= 700 ? "is-severe" : vel >= 550 ? "is-storm" : vel >= 450 ? "is-active" : "is-calm";
      set("vs-vel", num(vel, 0) + " km/s", clsV);
      set("vs-dens", num(last.proton_density, 1) + " p/cm³");
      set("vs-time", "Satélite " + escapeHTML(last.source || "ACE/DSCOVR") + " · " + ago(parseUTC(last.time_tag)));
      resumo.vento = num(vel, 0) + " km/s";
      renderNowSummary();
    });

    var p2 = getJSON(SRC.ventoMag).then(function (rows) {
      var bons = rows.filter(function (r) { return r.bt !== null && r.bz_gsm !== null; });
      if (!bons.length) bons = rows.filter(function (r) { return r.bt !== null; });
      if (!bons.length) throw new Error("sem dados");
      bons.sort(function (a, b) { return parseUTC(a.time_tag) - parseUTC(b.time_tag); });
      var last = bons[bons.length - 1];
      var bz = last.bz_gsm !== null && last.bz_gsm !== undefined ? last.bz_gsm : last.bz_gse;

      set("vs-bt", num(last.bt, 1) + " nT");
      var clsB = bz <= -10 ? "is-severe" : bz <= -5 ? "is-storm" : bz < 0 ? "is-active" : "is-calm";
      set("vs-bz", num(bz, 1) + " nT", clsB);
      set("vs-bz-lab", bz < 0 ? "a apontar para sul" : "a apontar para norte");

      set("vs-leitura", bz <= -10
        ? "Bz fortemente para sul. É a configuração que abre a porta ao vento solar; se durar, o Kp sobe nas próximas horas."
        : bz <= -5
        ? "Bz para sul. Alguma energia está a entrar no campo magnético da Terra. Vale a pena vigiar o Kp."
        : bz < 0
        ? "Bz ligeiramente para sul. Acoplamento fraco, sem consequência esperada."
        : "Bz para norte. O campo do vento solar não se liga ao da Terra: a porta está fechada e a energia passa ao lado.");

      bzChart("vs-chart", bons.slice(-720));
      mark("vento", true);
    });

    return Promise.all([p1, p2]).catch(function (e) {
      fail("vs-vel"); fail("vs-bz");
      mark("vento", false);
      console.warn("Vento solar:", e);
    });
  }

  // Gráfico do Bz com a linha do zero destacada: acima é norte, abaixo é sul.
  function bzChart(hostId, rows) {
    var host = document.getElementById(hostId);
    if (!host) return;
    var W = 900, H = 200, padL = 38, padB = 20, padT = 10, padR = 8;
    var iw = W - padL - padR, ih = H - padB - padT;

    var vals = rows.map(function (r) {
      var v = r.bz_gsm !== null && r.bz_gsm !== undefined ? r.bz_gsm : r.bz_gse;
      return Number(v) || 0;
    });
    var lim = Math.max(10, Math.ceil(Math.max.apply(null, vals.map(Math.abs)) / 5) * 5);
    var y0 = padT + ih / 2;
    var s = "";

    // metade sul sombreada: é a que interessa
    s += '<rect x="' + padL + '" y="' + y0 + '" width="' + iw + '" height="' + (ih / 2) +
         '" fill="#f43f5e" fill-opacity=".05"/>';

    [lim, lim / 2, 0, -lim / 2, -lim].forEach(function (v) {
      var y = y0 - (v / lim) * (ih / 2);
      s += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) +
           '" stroke="rgba(255,255,255,' + (v === 0 ? ".22" : ".06") + ')"/>' +
           '<text x="' + (padL - 6) + '" y="' + (y + 4).toFixed(1) + '" fill="#6b7391" font-size="10" text-anchor="end">' +
           (v > 0 ? "+" : "") + v + "</text>";
    });

    var d = vals.map(function (v, i) {
      var x = padL + (i / Math.max(vals.length - 1, 1)) * iw;
      var y = y0 - (Math.max(-lim, Math.min(lim, v)) / lim) * (ih / 2);
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");

    s += '<path d="' + d + '" fill="none" stroke="#a78bfa" stroke-width="1.6" stroke-linejoin="round"/>';
    s += '<text x="' + (padL + 6) + '" y="' + (padT + 12) + '" fill="#34d399" font-size="10">norte, sem efeito</text>';
    s += '<text x="' + (padL + 6) + '" y="' + (H - padB - 4) + '" fill="#f43f5e" font-size="10">sul, deixa entrar energia</text>';

    host.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' + s + "</svg>";
  }

  // ----------------------------------------------------------
  // Escalas NOAA R (rádio) / S (radiação) / G (geomagnética)
  // ----------------------------------------------------------

  function loadScales() {
    return getJSON(SRC.scales).then(function (obj) {
      var agora = obj["0"];
      if (!agora) throw new Error("sem dados");
      var host = document.getElementById("noaa-scales");
      if (!host) return;

      var defs = [
        { k: "R", nome: "R · rádio", legenda: "apagões de rádio" },
        { k: "S", nome: "S · radiação", legenda: "tempestade de radiação" },
        { k: "G", nome: "G · geomagnética", legenda: "tempestade geomagnética" }
      ];

      host.innerHTML = defs.map(function (d) {
        var v = agora[d.k] || {};
        var n = Number(v.Scale || 0);
        var cls = n === 0 ? "is-calm" : n <= 1 ? "is-active" : n <= 2 ? "is-storm" : "is-severe";
        var txt = (!v.Text || v.Text === "none") ? "sem atividade" : escapeHTML(v.Text);
        return '<div class="scale-box"><div class="letter">' + d.nome + "</div>" +
               '<div class="lvl ' + cls + '">' + d.k + n + "</div>" +
               '<div class="txt">' + txt + "</div></div>";
      }).join("");
    }).catch(function (e) { console.warn("Escalas NOAA:", e); });
  }

  // ----------------------------------------------------------
  // Previsão a 3 dias em cartões (Kp máximo por dia)
  // ----------------------------------------------------------

  function loadForecastDays() {
    return getJSON(SRC.kpForecastJson).then(function (rows) {
      var host = document.getElementById("fc-days");
      if (!host) return;

      var porDia = {};
      rows.forEach(function (r) {
        var t = parseUTC(r.time_tag || r[0]);
        var v = Number(r.kp !== undefined ? r.kp : r[1]);
        var obs = String(r.observed !== undefined ? r.observed : r[2] || "");
        if (!t || !isFinite(v) || !/pred/i.test(obs)) return;
        var dia = t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate());
        if (!porDia[dia] || v > porDia[dia]) porDia[dia] = v;
      });

      var dias = Object.keys(porDia).sort().slice(0, 3);
      if (!dias.length) return;

      host.innerHTML = dias.map(function (d) {
        var v = porDia[d];
        var info = kpInfo(v);
        var data = new Date(d + "T12:00:00Z");
        var rot;
        try {
          rot = new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(data);
        } catch (e) { rot = d; }
        return '<div class="fc-day"><div class="d">' + escapeHTML(rot) + "</div>" +
               '<div class="v ' + info.cls + '">' + num(v) + "</div>" +
               '<div class="s">' + escapeHTML(info.label) + "</div></div>";
      }).join("");
    }).catch(function (e) { console.warn("Previsão 3 dias:", e); });
  }

  // ----------------------------------------------------------
  // Mapa mundial: sismos das últimas 48 h e vulcões em atividade
  //
  // Os contornos dos continentes vêm do Natural Earth (domínio público),
  // simplificados e embebidos em js/world-path.js, sem serviço externo
  // de mapas e sem imagens de terceiros.
  // ----------------------------------------------------------

  var MAPA_W = 720, MAPA_H = 360;
  var dadosMapa = { sismos: [], vulcoes: [] };
  var vistaMapa = "ambos";

  function projX(lon) { return ((lon + 180) / 360) * MAPA_W; }
  function projY(lat) { return ((90 - lat) / 180) * MAPA_H; }

  function corSismo(m) {
    return m >= 6.5 ? "#f43f5e" : m >= 5.5 ? "#fb923c" : m >= 4.5 ? "#fbbf24" : "#38bdf8";
  }

  function renderQuakeMap() {
    var host = document.getElementById("quake-map");
    if (!host) return;
    var s = "";
    marcas = [];   // índice das marcas desenhadas, para a caixa de informação

    s += '<defs>' +
      '<linearGradient id="oceano" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#0b1a30"/><stop offset="55%" stop-color="#08111f"/>' +
        '<stop offset="100%" stop-color="#0b1a30"/></linearGradient>' +
      "</defs>";

    s += '<rect width="' + MAPA_W + '" height="' + MAPA_H + '" fill="url(#oceano)"/>';

    for (var lon = -150; lon <= 150; lon += 30) {
      var x = projX(lon);
      s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + MAPA_H + '" stroke="rgba(125,180,235,.055)"/>';
    }
    for (var lat = -60; lat <= 60; lat += 30) {
      var y = projY(lat);
      s += '<line x1="0" y1="' + y + '" x2="' + MAPA_W + '" y2="' + y + '" stroke="rgba(125,180,235,.055)"/>';
    }
    s += '<line x1="0" y1="' + (MAPA_H / 2) + '" x2="' + MAPA_W + '" y2="' + (MAPA_H / 2) +
         '" stroke="rgba(125,180,235,.14)" stroke-dasharray="5 7"/>';

    if (window.MAPA_MUNDO) {
      s += '<path d="' + window.MAPA_MUNDO + '" fill="#15243a" stroke="#4a7ba8" stroke-width=".7" ' +
           'stroke-linejoin="round" stroke-opacity=".8"/>';
    }

    // Sismos: raio proporcional à raiz da energia, sem desfoque.
    // O desfoque transformava os pontos em manchas sobrepostas.
    if (vistaMapa !== "vulcoes") {
      dadosMapa.sismos.slice().sort(function (a, b) {
        return (a.properties.mag || 0) - (b.properties.mag || 0);
      }).forEach(function (f) {
        var c = f.geometry && f.geometry.coordinates;
        if (!c) return;
        var m = f.properties.mag || 0;
        var r = Math.max(2.2, Math.pow(Math.max(m - 2, 0.2), 1.45) * 1.25);
        var cor = corSismo(m);
        var i = marcas.length;

        marcas.push({
          tipo: "sismo", x: projX(c[0]), y: projY(c[1]), r: r,
          titulo: "M" + num(m) + " · " + traduzLocal(f.properties.place),
          linhas: [
            (c[2] != null ? Math.round(c[2]) + " km de profundidade" : "profundidade desconhecida"),
            ago(new Date(f.properties.time))
          ],
          cor: cor
        });

        // halo suave só nos sismos que importam
        if (m >= 5.5) {
          s += '<circle cx="' + projX(c[0]).toFixed(1) + '" cy="' + projY(c[1]).toFixed(1) +
               '" r="' + (r * 2.1).toFixed(1) + '" fill="' + cor + '" fill-opacity=".13"/>';
        }
        s += '<circle class="mk" data-i="' + i + '" cx="' + projX(c[0]).toFixed(1) + '" cy="' +
             projY(c[1]).toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + cor +
             '" fill-opacity=".85" stroke="#0b1220" stroke-width=".9"/>';
      });
    }

    if (vistaMapa !== "sismos") {
      dadosMapa.vulcoes.forEach(function (v) {
        var x = projX(v.lon), y = projY(v.lat), i = marcas.length;
        marcas.push({
          tipo: "vulcao", x: x, y: y, r: 5,
          titulo: "Vulcão " + traduzLocal(v.nome),
          linhas: ["em erupção" + (v.desde ? " " + ago(v.desde) : "")],
          cor: "#ff5470"
        });
        s += '<path class="mk" data-i="' + i + '" d="M' + x.toFixed(1) + " " + (y - 5.2).toFixed(1) +
             "L" + (x + 4.5).toFixed(1) + " " + (y + 3.4).toFixed(1) +
             "L" + (x - 4.5).toFixed(1) + " " + (y + 3.4).toFixed(1) + 'Z" ' +
             'fill="#ff5470" fill-opacity=".9" stroke="#0b1220" stroke-width=".8" stroke-linejoin="round"/>';
      });
    }

    s += '<circle id="mk-foco" r="0" fill="none" stroke="#fff" stroke-width="1.6" opacity="0" pointer-events="none"/>';

    host.innerHTML = '<svg viewBox="0 0 ' + MAPA_W + " " + MAPA_H +
      '" role="img" aria-label="Mapa mundial de sismos das últimas 48 horas e vulcões em atividade">' + s + "</svg>";

    ligaInfoMapa(host);
  }

  // Lista dos sismos, do mais recente para o mais antigo, ligada ao mapa.
  function renderQuakeFeed() {
    var host = document.getElementById("quake-feed");
    if (!host) return;

    var lista = dadosMapa.sismos.slice().sort(function (a, b) {
      return b.properties.time - a.properties.time;
    });

    if (!lista.length) {
      host.innerHTML = '<li class="muted">Nenhum sismo registado nas últimas 48 horas.</li>';
      return;
    }

    host.innerHTML = lista.map(function (f, i) {
      var p = f.properties, c = f.geometry.coordinates;
      var m = p.mag || 0;
      return '<li data-lon="' + c[0] + '" data-lat="' + c[1] + '" title="Clique para centrar no mapa">' +
        '<span class="mag" style="color:' + corSismo(m) + '">M' + num(m) + "</span>" +
        '<span class="loc">' + escapeHTML(traduzLocal(p.place)) + "</span>" +
        '<span class="qd">' + (c[2] != null ? Math.round(c[2]) + " km · " : "") + ago(new Date(p.time)) + "</span></li>";
    }).join("");

    // Passar o rato numa linha acende a marca correspondente no mapa.
    $$("#quake-feed li[data-lon]").forEach(function (li) {
      li.addEventListener("mouseenter", function () { focaMarca(+li.dataset.lon, +li.dataset.lat, true); });
      li.addEventListener("mouseleave", function () { focaMarca(null); });
      li.addEventListener("click", function () {
        $$("#quake-feed li.on").forEach(function (o) { o.classList.remove("on"); });
        li.classList.add("on");
        var mapa = document.getElementById("quake-map");
        if (mapa) mapa.scrollIntoView({ block: "nearest", behavior: "smooth" });
        focaMarca(+li.dataset.lon, +li.dataset.lat, true);
      });
    });
  }

  // ----------------------------------------------------------
  // Caixa de informação que segue o rato sobre o mapa
  // ----------------------------------------------------------

  var marcas = [];

  // Realça no mapa a marca que está nestas coordenadas.
  function focaMarca(lon, lat, mostrarCaixa) {
    var host = document.getElementById("quake-map");
    if (!host) return;
    var svg = host.querySelector("svg");
    var foco = svg && svg.querySelector("#mk-foco");
    var tip = host.querySelector(".map-tip");
    if (!foco) return;

    if (lon === null || lon === undefined) {
      foco.setAttribute("opacity", "0");
      if (tip) tip.hidden = true;
      return;
    }

    var x = projX(lon), y = projY(lat), alvo = null, dMin = Infinity;
    marcas.forEach(function (m) {
      var d = Math.hypot(m.x - x, m.y - y);
      if (d < dMin) { dMin = d; alvo = m; }
    });
    if (!alvo || dMin > 3) return;

    foco.setAttribute("cx", alvo.x.toFixed(1));
    foco.setAttribute("cy", alvo.y.toFixed(1));
    foco.setAttribute("r", (alvo.r + 5).toFixed(1));
    foco.setAttribute("opacity", "1");

    if (mostrarCaixa && tip) {
      tip.innerHTML = '<b style="color:' + alvo.cor + '">' + escapeHTML(alvo.titulo) + "</b>" +
        alvo.linhas.map(function (l) { return "<span>" + escapeHTML(l) + "</span>"; }).join("");
      tip.hidden = false;
      var cx = svg.getBoundingClientRect();
      var px = (alvo.x / MAPA_W) * cx.width, py = (alvo.y / MAPA_H) * cx.height;
      var w = tip.offsetWidth || 200;
      tip.style.left = Math.max(6, Math.min(px - w / 2, cx.width - w - 6)) + "px";
      tip.style.top = Math.max(6, py - tip.offsetHeight - 12) + "px";
    }
  }

  function ligaInfoMapa(host) {
    var svg = host.querySelector("svg");
    if (!svg) return;

    var tip = host.querySelector(".map-tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "map-tip";
      tip.hidden = true;
      host.appendChild(tip);
    }
    var foco = svg.querySelector("#mk-foco");

    function maisPerto(ev) {
      // Converte a posição do rato para coordenadas do desenho e procura a
      // marca mais próxima. É mais tolerante do que exigir acertar no ponto.
      var cx = svg.getBoundingClientRect();
      var mx = ((ev.clientX - cx.left) / cx.width) * MAPA_W;
      var my = ((ev.clientY - cx.top) / cx.height) * MAPA_H;
      var melhor = null, dMin = Infinity;
      for (var i = 0; i < marcas.length; i++) {
        var m = marcas[i];
        var d = Math.hypot(m.x - mx, m.y - my);
        if (d < Math.max(m.r + 4, 7) && d < dMin) { dMin = d; melhor = m; }
      }
      return melhor;
    }

    svg.onmousemove = function (ev) {
      var m = maisPerto(ev);
      if (!m) { tip.hidden = true; if (foco) foco.setAttribute("opacity", "0"); return; }

      tip.innerHTML = '<b style="color:' + m.cor + '">' + escapeHTML(m.titulo) + "</b>" +
                      m.linhas.map(function (l) { return "<span>" + escapeHTML(l) + "</span>"; }).join("");
      tip.hidden = false;

      var cx = svg.getBoundingClientRect();
      var px = (m.x / MAPA_W) * cx.width;
      var py = (m.y / MAPA_H) * cx.height;
      var largura = tip.offsetWidth || 200;
      tip.style.left = Math.max(6, Math.min(px - largura / 2, cx.width - largura - 6)) + "px";
      tip.style.top  = Math.max(6, py - tip.offsetHeight - 12) + "px";

      if (foco) {
        foco.setAttribute("cx", m.x.toFixed(1));
        foco.setAttribute("cy", m.y.toFixed(1));
        foco.setAttribute("r", (m.r + 4).toFixed(1));
        foco.setAttribute("opacity", "0.9");
      }
    };

    svg.onmouseleave = function () {
      tip.hidden = true;
      if (foco) foco.setAttribute("opacity", "0");
    };
  }

  function wireMapaTabs() {
    var host = document.getElementById("map-tabs");
    if (!host) return;
    var vistas = [
      { id: "ambos", rot: "Tudo" },
      { id: "sismos", rot: "Só sismos" },
      { id: "vulcoes", rot: "Só vulcões" }
    ];
    function pinta() {
      host.innerHTML = vistas.map(function (v) {
        return '<button class="tab" type="button" data-id="' + v.id + '" aria-selected="' +
               (v.id === vistaMapa) + '">' + v.rot + "</button>";
      }).join("");
      $$(".tab", host).forEach(function (b) {
        b.addEventListener("click", function () {
          vistaMapa = b.getAttribute("data-id");
          pinta();
          renderQuakeMap();
        });
      });
    }
    pinta();
  }

  // Sismos das últimas 48 horas (M2,5+), muitos mais pontos, desenha o risco tectónico
  function loadQuakes48() {
    return getJSON(SRC.quakes48).then(function (geo) {
      var limite = Date.now() - 48 * 3600 * 1000;
      dadosMapa.sismos = (geo.features || []).filter(function (f) {
        return f.properties.time >= limite;
      });
      set("q48-count", String(dadosMapa.sismos.length));
      renderQuakeMap();
      renderQuakeFeed();
    }).catch(function (e) { console.warn("Sismos 48 h:", e); });
  }

  // Estatística de 30 dias, para dizer se o dia está acima ou abaixo do normal
  function loadQuakesMes() {
    return getJSON(SRC.quakesMes).then(function (geo) {
      var feats = geo.features || [];
      set("q30-count", String(feats.length));

      var mediaDia = feats.length / 30;
      var hoje = state.quakeCount;
      if (hoje === null || !mediaDia) return;

      var razao = hoje / mediaDia;
      var nivel, cls;
      if (razao < 0.6)      { nivel = "Abaixo do normal"; cls = "is-calm"; }
      else if (razao < 1.4) { nivel = "Normal";           cls = "is-mild"; }
      else if (razao < 2)   { nivel = "Acima do normal";  cls = "is-active"; }
      else                  { nivel = "Muito elevado";    cls = "is-storm"; }

      set("seismic-level", nivel, cls);
      set("seismic-detail", "Média de " + num(mediaDia) + " sismos M4,5+ por dia nos últimos 30 dias; hoje vão " + hoje + ".");
    }).catch(function (e) { console.warn("Sismos 30 dias:", e); });
  }

  // Vulcões em erupção, NASA EONET
  function loadVulcoes() {
    return getJSON(SRC.vulcoes).then(function (j) {
      var evs = j.events || [];
      dadosMapa.vulcoes = evs.map(function (e) {
        var g = e.geometry && e.geometry[e.geometry.length - 1];
        var c = g && g.coordinates;
        if (!c) return null;
        return {
          nome: String(e.title || "").replace(/\s*\bVolcano\b/i, "").replace(/\s+,/g, ",").trim(),
          lon: c[0], lat: c[1],
          desde: g.date ? parseUTC(g.date) : null
        };
      }).filter(Boolean);

      set("volcano-count", String(dadosMapa.vulcoes.length));

      var host = document.getElementById("volcano-list");
      if (host) {
        if (!dadosMapa.vulcoes.length) {
          host.innerHTML = '<li class="muted">Sem erupções ativas registadas no momento.</li>';
        } else {
          host.innerHTML = dadosMapa.vulcoes.map(function (v) {
            return '<li><span>🌋</span><span>' + escapeHTML(traduzLocal(v.nome)) + "</span>" +
                   '<span class="v" style="font-weight:400;color:var(--text-faint);font-size:12px">' +
                   (v.desde ? "desde " + ago(v.desde) : "") + "</span></li>";
          }).join("");
        }
      }
      renderQuakeMap();
      mark("vulcoes", true);
    }).catch(function (e) {
      var host = document.getElementById("volcano-list");
      if (host) host.innerHTML = '<li class="err">Lista de vulcões indisponível.</li>';
      mark("vulcoes", false);
      console.warn("Vulcões:", e);
    });
  }

  // ----------------------------------------------------------
  // Resumo textual e leitura do dia
  // ----------------------------------------------------------

  var resumo = {};

  function renderNowSummary() {
    var el = document.getElementById("now-summary");
    if (!el || state.kp === null) return;
    var info = kpInfo(state.kp);
    var partes = [];

    partes.push("campo geomagnético em estado <b>" + info.label.toLowerCase() + "</b> (Kp " + num(state.kp) + ")");
    if (resumo.xray) partes.push("fluxo de raios-X <b>" + resumo.xray + "</b>");
    if (resumo.protao) partes.push("protões em <b>" + resumo.protao + "</b>");
    if (resumo.vento) partes.push("vento solar a <b>" + resumo.vento + "</b>");
    if (resumo.energia !== undefined) partes.push("índice de energia <b>" + resumo.energia + " em 100</b> (" + resumo.palavra.toLowerCase() + ")");
    if (resumo.flare) partes.push("última erupção solar <b>" + resumo.flare + "</b>, " + resumo.flareQuando);
    if (resumo.sismos !== undefined) {
      partes.push("<b>" + resumo.sismos + "</b> sismos de magnitude 4,5 ou superior nas últimas 24 h" +
        (resumo.sismoMax ? " (máximo M" + num(resumo.sismoMax) + ")" : ""));
    }
    if (resumo.espectro) partes.push("registo da estação de Tomsk até às <b>" + resumo.espectro + " UTC</b>");

    el.innerHTML = "<b>Agora mesmo na Terra:</b> " + partes.join("; ") + "." +
      '<span class="stamp">Atualizado às ' + hhmm(new Date()) + " UTC · " + fmtDatePT(new Date()) + "</span>";
  }

  function renderInsight() {
    if (resumo.energia === undefined) return;
    set("insight-state", resumo.palavra, "state " + resumo.cls);
    set("insight-title", resumo.titulo || "…");
    set("insight-kp", state.kp !== null ? num(state.kp) : "…");
    set("insight-xray", resumo.xray || "…");
    set("insight-energy", resumo.energia + "/100");
  }

  // ----------------------------------------------------------
  // Pulso: registo pessoal de sintomas
  //
  // Por omissão funciona inteiramente no navegador: os registos ficam em
  // localStorage e nunca saem do dispositivo. O ranking mostrado é real:
  // é a contagem dos próprios registos do visitante nos últimos 30 dias.
  //
  // Para transformar isto num verdadeiro pulso da comunidade basta definir
  // PULSO_API com um endpoint que aceite POST {sintomas:[...]} e responda
  // a GET com {total: n, contagens: {id: n}}. Ver README.md, secção 9.
  // Enquanto PULSO_API estiver vazio, o site diz claramente que os números
  // são apenas do próprio visitante, nunca finge ter votos de terceiros.
  // ----------------------------------------------------------

  var PULSO_API = "";
  var PULSO_KEY = "rs_pulso_v1";
  var PULSO_DIAS = 30;

  var SINTOMAS = [
    { id: "cansaco",      nome: "Cansaço",              ico: "😴" },
    { id: "cabeca",       nome: "Dor de cabeça",        ico: "🤕" },
    { id: "zumbido",      nome: "Zumbido nos ouvidos",  ico: "🔔" },
    { id: "insonia",      nome: "Insónia",              ico: "🌙" },
    { id: "sonhos",       nome: "Sonhos intensos",      ico: "💭" },
    { id: "ansiedade",    nome: "Ansiedade",            ico: "🌀" },
    { id: "irritavel",    nome: "Irritabilidade",       ico: "⚡" },
    { id: "nevoa",        nome: "Névoa mental",         ico: "🌫️" },
    { id: "tonturas",     nome: "Tonturas",             ico: "💫" },
    { id: "musculos",     nome: "Dores musculares",     ico: "💪" },
    { id: "palpitacoes",  nome: "Palpitações",          ico: "❤️" },
    { id: "desmotivado",  nome: "Falta de vontade",     ico: "🪫" },
    { id: "sensivel",     nome: "Sensível à luz ou som", ico: "🔆" },
    { id: "calma",        nome: "Calma",                ico: "🕊️" },
    { id: "gratidao",     nome: "Gratidão",             ico: "🌱" },
    { id: "energia",      nome: "Muita energia",        ico: "🔥" },
    { id: "foco",         nome: "Foco nítido",          ico: "🎯" },
    { id: "normal",       nome: "Nada de especial",     ico: "😐" }
  ];

  var pulsoSel = [];

  function hojeISO() {
    var d = new Date();
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  function pulsoLer() {
    try { return JSON.parse(localStorage.getItem(PULSO_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function pulsoGravar(dados) {
    try { localStorage.setItem(PULSO_KEY, JSON.stringify(dados)); return true; }
    catch (e) { return false; }   // modo privado ou armazenamento cheio
  }

  function renderChips() {
    var host = document.getElementById("sintoma-chips");
    if (!host) return;
    host.innerHTML = SINTOMAS.map(function (s) {
      var on = pulsoSel.indexOf(s.id) > -1;
      return '<button type="button" class="chip" data-id="' + s.id + '" aria-pressed="' + on + '">' +
             '<span aria-hidden="true">' + s.ico + "</span>" + escapeHTML(s.nome) +
             '<span class="tick" aria-hidden="true">✓</span></button>';
    }).join("");

    $$(".chip", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-id");
        var i = pulsoSel.indexOf(id);
        if (i > -1) pulsoSel.splice(i, 1); else pulsoSel.push(id);
        b.setAttribute("aria-pressed", i > -1 ? "false" : "true");
        var msg = document.getElementById("pulso-msg");
        if (msg) msg.textContent = "";
      });
    });
  }

  function pulsoRanking() {
    var dados = pulsoLer();
    var limite = Date.now() - PULSO_DIAS * 86400000;
    var contagens = {}, dias = 0;

    Object.keys(dados).forEach(function (dia) {
      var t = Date.parse(dia + "T00:00:00Z");
      if (isNaN(t) || t < limite) return;
      dias++;
      (dados[dia] || []).forEach(function (id) {
        contagens[id] = (contagens[id] || 0) + 1;
      });
    });

    // Todos os sintomas entram na lista, mesmo com zero, assim o gráfico
    // existe desde a primeira visita, em vez de aparecer só depois de votar.
    var lista = SINTOMAS.map(function (s) {
      return { id: s.id, nome: s.nome, ico: s.ico, n: contagens[s.id] || 0 };
    }).sort(function (a, b) { return b.n - a.n || a.nome.localeCompare(b.nome, "pt"); });

    return { lista: lista.slice(0, 10), dias: dias, hoje: dados[hojeISO()] || null };
  }

  function renderPulso() {
    var caixa = document.getElementById("pulso-resultados");
    var ol = document.getElementById("pulso-rank");
    if (!caixa || !ol) return;

    var r = pulsoRanking();
    var limpar = document.getElementById("pulso-limpar");
    if (limpar) limpar.hidden = r.dias === 0;

    var max = Math.max(r.lista[0] ? r.lista[0].n : 0, 1);
    ol.innerHTML = r.lista.map(function (s, i) {
      var meuHoje = r.hoje && r.hoje.indexOf(s.id) > -1;
      return '<li class="clickable' + (meuHoje ? " mine" : "") + '" data-id="' + s.id +
        '" title="Clique para marcar ou desmarcar este sintoma">' +
        '<div class="row"><span class="pos">#' + (i + 1) + "</span>" +
        '<span class="nome">' + s.ico + " " + escapeHTML(s.nome) + "</span>" +
        '<span class="cnt">' + s.n + "</span></div>" +
        '<div class="bar"><i style="width:' + Math.round((s.n / max) * 100) + '%"></i></div></li>';
    }).join("");

    set("pulso-total", String(r.dias));
    set("pulso-total-txt", r.dias === 0 ? "registos ainda, seja o primeiro"
        : r.dias === 1 ? "dia registado" : "dias registados");
    set("pulso-origem", r.dias === 0 ? "" : PULSO_API
      ? "· partilhado por todos os visitantes (30 dias)"
      : "· só os seus, guardados neste dispositivo (30 dias)");

    // Clicar numa linha do ranking marca ou desmarca esse sintoma.
    $$("#pulso-rank li.clickable").forEach(function (li) {
      li.addEventListener("click", function () {
        var chip = document.querySelector('.chip[data-id="' + li.getAttribute("data-id") + '"]');
        if (chip) { chip.click(); chip.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
      });
    });
  }

  function wirePulso() {
    var host = document.getElementById("sintoma-chips");
    if (!host) return;

    // Pré-seleciona o que já tiver registado hoje, para poder corrigir.
    var dados = pulsoLer();
    pulsoSel = (dados[hojeISO()] || []).slice();
    renderChips();
    renderPulso();

    var bt = document.getElementById("pulso-guardar");
    if (bt) bt.addEventListener("click", function () {
      var msg = document.getElementById("pulso-msg");
      var d = pulsoLer();
      if (pulsoSel.length) d[hojeISO()] = pulsoSel.slice();
      else delete d[hojeISO()];

      if (!pulsoGravar(d)) {
        if (msg) { msg.textContent = "Não foi possível guardar, o navegador está a bloquear o armazenamento local."; msg.style.color = "var(--red)"; }
        return;
      }
      if (msg) {
        msg.style.color = "";
        msg.textContent = pulsoSel.length
          ? "Registado. Volte amanhã, o padrão só aparece com o tempo."
          : "Registo de hoje apagado.";
      }
      if (PULSO_API) enviarPulso(pulsoSel);
      renderPulso();
    });

    var lp = document.getElementById("pulso-limpar");
    if (lp) lp.addEventListener("click", function () {
      if (!window.confirm("Apagar todo o seu histórico de registos? Não é reversível.")) return;
      try { localStorage.removeItem(PULSO_KEY); } catch (e) {}
      pulsoSel = [];
      renderChips();
      renderPulso();
      var msg = document.getElementById("pulso-msg");
      if (msg) { msg.style.color = ""; msg.textContent = "Histórico apagado."; }
    });
  }

  // Só usado quando PULSO_API estiver configurado.
  function enviarPulso(sel) {
    fetch(PULSO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dia: hojeISO(), sintomas: sel })
    }).catch(function (e) { console.warn("Pulso:", e); });
  }

  // ----------------------------------------------------------
  // Visualizador solar com separadores
  // ----------------------------------------------------------

  var VISTAS_SOLARES = [
    { id: "131", rot: "SUVI 131 Å", titulo: "131 ångström, plasma a milhões de graus",
      desc: "O canal mais quente. Fica praticamente vazio quando o Sol está calmo e ilumina-se durante as erupções, é aqui que uma erupção de classe M ou X se vê primeiro.",
      url: SRC_SUVI("131"), fonte: "NOAA GOES SUVI" },
    { id: "171", rot: "SUVI 171 Å", titulo: "171 ångström, a coroa tranquila",
      desc: "Mostra os arcos de plasma que seguem as linhas do campo magnético. É a imagem que melhor revela a estrutura magnética da atmosfera solar.",
      url: SRC_SUVI("171"), fonte: "NOAA GOES SUVI" },
    { id: "195", rot: "SUVI 195 Å", titulo: "195 ångström, buracos coronais",
      desc: "As manchas escuras são buracos coronais: zonas onde o campo magnético abre para o espaço e deixa escapar vento solar rápido. Alguns dias depois, esse vento chega à Terra e faz subir o Kp.",
      url: SRC_SUVI("195"), fonte: "NOAA GOES SUVI" },
    { id: "304", rot: "SUVI 304 Å", titulo: "304 ångström, filamentos e proeminências",
      desc: "Mostra a cromosfera. Os fios escuros são filamentos de plasma suspensos; quando um colapsa, pode lançar uma ejeção de massa coronal na nossa direção.",
      url: SRC_SUVI("304"), fonte: "NOAA GOES SUVI" },
    { id: "c2", rot: "LASCO C2", titulo: "Coronógrafo C2, a coroa próxima",
      desc: "O disco solar é tapado por um obstáculo para revelar o que está à volta. É nestas imagens que as ejeções de massa coronal aparecem, como nuvens que se expandem para fora.",
      url: "https://services.swpc.noaa.gov/images/animations/lasco-c2/latest.jpg", fonte: "SOHO / LASCO" },
    { id: "c3", rot: "LASCO C3", titulo: "Coronógrafo C3, campo de visão largo",
      desc: "Vê muito mais longe do que o C2. Uma nuvem que aqui se expanda simetricamente em todas as direções vem provavelmente na nossa direção e chega em 1 a 3 dias.",
      url: "https://services.swpc.noaa.gov/images/animations/lasco-c3/latest.jpg", fonte: "SOHO / LASCO" }
  ];

  function SRC_SUVI(n) {
    return "https://services.swpc.noaa.gov/images/animations/suvi/primary/" + n + "/latest.png";
  }

  var vistaAtual = "304";

  function renderSolarTabs() {
    var tabs = document.getElementById("solar-tabs");
    if (!tabs) return;

    tabs.innerHTML = VISTAS_SOLARES.map(function (v) {
      return '<button class="tab" type="button" role="tab" data-id="' + v.id +
             '" aria-selected="' + (v.id === vistaAtual) + '">' + v.rot + "</button>";
    }).join("");

    $$(".tab", tabs).forEach(function (b) {
      b.addEventListener("click", function () {
        vistaAtual = b.getAttribute("data-id");
        renderSolarTabs();
        mostrarVistaSolar();
      });
    });
  }

  function mostrarVistaSolar() {
    var v = VISTAS_SOLARES.filter(function (x) { return x.id === vistaAtual; })[0];
    if (!v) return;
    var img = document.getElementById("solar-img");
    if (img) {
      img.src = v.url + "?t=" + Date.now();
      img.alt = v.titulo;
      img.setAttribute("data-zoom", v.titulo);
    }
    set("solar-title", escapeHTML(v.titulo));
    set("solar-desc", escapeHTML(v.desc));
    set("solar-src", "Fonte: " + escapeHTML(v.fonte) + " · domínio público · clique na imagem para ampliar");
  }

  // ----------------------------------------------------------
  // Ampliação de imagens (lightbox)
  // ----------------------------------------------------------

  function abrirLightbox(src, legenda) {
    var lb = document.getElementById("lightbox");
    var im = document.getElementById("lightbox-img");
    if (!lb || !im) return;
    im.src = src;
    im.alt = legenda || "";
    set("lightbox-cap", escapeHTML(legenda || "") + " · prima Esc ou clique fora para fechar");
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    var bt = document.getElementById("lightbox-close");
    if (bt) bt.focus();
  }

  function fecharLightbox() {
    var lb = document.getElementById("lightbox");
    if (!lb) return;
    lb.hidden = true;
    document.body.style.overflow = "";
  }

  function wireLightbox() {
    var lb = document.getElementById("lightbox");
    if (!lb) return;

    var fechar = document.getElementById("lightbox-close");
    if (fechar) fechar.addEventListener("click", fecharLightbox);
    lb.addEventListener("click", function (ev) { if (ev.target === lb) fecharLightbox(); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !lb.hidden) fecharLightbox();
    });

    var zoom = document.getElementById("spectro-zoom");
    if (zoom) {
      var abrirEspectro = function () {
        var im = zoom.querySelector("img");
        if (im && im.src) abrirLightbox(im.src, "Espectrograma da Ressonância de Schumann · estação de Tomsk");
      };
      zoom.addEventListener("click", abrirEspectro);
      zoom.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrirEspectro(); }
      });
    }

    var solar = document.getElementById("solar-img");
    if (solar) {
      solar.style.cursor = "zoom-in";
      solar.addEventListener("click", function () {
        abrirLightbox(solar.src, solar.getAttribute("data-zoom") || "");
      });
    }
  }

  // ----------------------------------------------------------
  // Botão de atualização manual
  // ----------------------------------------------------------

  function wireRefresh() {
    var bt = document.getElementById("btn-refresh");
    if (!bt) return;
    bt.addEventListener("click", function () {
      bt.classList.add("loading");
      bt.disabled = true;
      loadAll();
      refreshImages();
      mostrarVistaSolar();
      setTimeout(function () {
        bt.classList.remove("loading");
        bt.disabled = false;
      }, 1400);
    });
  }

  // ==========================================================
  // APOIO AO PROJETO
  //
  // É AQUI que se preenche tudo quando o site estiver online.
  // Não é preciso mexer em mais nenhum ficheiro: o bloco aparece
  // igual na página inicial e na página de apoio.
  //
  //   1. Crie os Payment Links em stripe.com  (Payments -> Payment Links)
  //   2. Crie o seu PayPal.me em paypal.com/paypalme
  //   3. Cole os endereços nos campos abaixo
  //
  // Enquanto os campos estiverem vazios, os botões ficam inertes e o site
  // mostra um aviso a dizer que ainda não estão ligados. É de propósito:
  // um botão de donativo que não faz nada é pior do que não ter botão.
  // ==========================================================

  var APOIO = {
    moeda: "€",
    meta: 200,               // meta mensal, em euros
    angariado: null,         // valor recebido este mês. null = ainda por ligar.
                             // Atualize à mão, ou ligue ao Stripe mais tarde.
    apoiantes: [],           // ex.: ["Ana R.", "Miguel S."]. Só quem autorizar.

    // Endereços de pagamento. Deixe vazio o que ainda não tiver.
    stripe: {
      "5":  "https://buy.stripe.com/eVqaEZ3vagF362k8tx6sw00",
      "15": "https://buy.stripe.com/fZueVf8Pu74tbmE6lp6sw01",
      "50": "https://buy.stripe.com/4gM6oJ7LqewV0I0fVZ6sw02",
      "livre": "https://buy.stripe.com/28E4gBfdS60p9ewaBF6sw03"
    },
    paypal: ""               // https://paypal.me/oseunome
  };

  var TIERS = [
    { v: 5,  rot: "um café",        destaque: false },
    { v: 15, rot: "um mês de site", destaque: true  },
    { v: 50, rot: "um trimestre",   destaque: false }
  ];

  function renderApoio() {
    var hosts = $$("[data-apoio]");
    if (!hosts.length) return;

    var agora = new Date();
    var mes = "";
    try {
      mes = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(agora);
      mes = mes.charAt(0).toUpperCase() + mes.slice(1);   // "agosto de 2026" -> "Agosto de 2026"
    } catch (e) { mes = ""; }

    var ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    var restam = ultimoDia - agora.getDate();

    var ligado = !!(APOIO.paypal || APOIO.stripe["5"] || APOIO.stripe["15"] ||
                    APOIO.stripe["50"] || APOIO.stripe.livre);
    var temValor = typeof APOIO.angariado === "number" && APOIO.angariado >= 0;
    var pct = temValor ? Math.max(0, Math.min(100, (APOIO.angariado / APOIO.meta) * 100)) : 0;

    var valorTxt = temValor
      ? APOIO.moeda + num(APOIO.angariado, 0) + ' <small>de ' + APOIO.moeda + num(APOIO.meta, 0) + "</small>"
      : '<small>meta de ' + APOIO.moeda + num(APOIO.meta, 0) + " este mês</small>";

    var nota = temValor
      ? (pct >= 100
          ? "<b>Meta atingida.</b> Obrigado. O que vier a mais fica para o mês seguinte."
          : "Faltam <b>" + APOIO.moeda + num(APOIO.meta - APOIO.angariado, 0) +
            "</b> para cobrir domínio e alojamento deste mês.")
      : "Cobre domínio, alojamento e o tempo de verificar os dados todos os dias.";

    var botoes = TIERS.map(function (t) {
      var url = APOIO.stripe[String(t.v)];
      var attrs = url ? 'href="' + escapeHTML(url) + '" rel="noopener"'
                      : 'href="#" aria-disabled="true" data-inerte';
      return '<a class="apoio-tier' + (t.destaque ? " destaque" : "") + '" ' + attrs + ">" +
             (t.destaque ? '<span class="selo">mais útil</span>' : "") +
             "<b>" + APOIO.moeda + t.v + "</b><span>" + t.rot + "</span></a>";
    }).join("");

    var livre = APOIO.stripe.livre;
    botoes += '<a class="apoio-tier" ' +
      (livre ? 'href="' + escapeHTML(livre) + '" rel="noopener"' : 'href="#" aria-disabled="true" data-inerte') +
      '><b style="font-size:19px">Outro</b><span>valor à escolha</span></a>';

    var obrigado = APOIO.apoiantes.length
      ? '<p class="apoio-obrigado">Obrigado a <b>' +
        APOIO.apoiantes.map(escapeHTML).join("</b>, <b>") + "</b>."
        : "";

    var aviso = ligado ? "" :
      '<p class="apoio-aviso">Os botões ainda não estão ligados a nenhum sistema de pagamento. ' +
      "Assim que tiver os endereços do Stripe e do PayPal, preencha o bloco <code>APOIO</code> " +
      "no topo de <code>js/app.js</code> e tudo passa a funcionar.</p>";

    var html =
      '<div class="apoio' + (ligado ? "" : " por-ligar") + '">' +
        '<div class="apoio-head">' +
          '<div class="apoio-icone">💜</div>' +
          "<div><h3>Mantenha este site independente</h3>" +
          "<p>Sem publicidade, sem rastreadores e sem paywall. Se o espectrograma ao vivo e as " +
          "leituras diárias lhe são úteis, um contributo mantém os servidores a trabalhar.</p></div>" +
        "</div>" +

        '<div class="apoio-meta">' +
          '<div class="apoio-meta-topo">' +
            '<span class="apoio-mes">' + escapeHTML(mes) + "</span>" +
            '<span class="apoio-restam">' + (restam > 0 ? "faltam " + restam + " dias" : "último dia") + "</span>" +
            '<span class="apoio-valor">' + valorTxt + "</span>" +
          "</div>" +
          '<div class="apoio-barra"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
          '<div class="apoio-marcos"><span>0</span><span>' + APOIO.moeda + num(APOIO.meta / 2, 0) +
            "</span><span>" + APOIO.moeda + num(APOIO.meta, 0) + "</span></div>" +
          '<p class="apoio-nota">' + nota + "</p>" +
        "</div>" +

        '<div class="apoio-tiers">' + botoes + "</div>" +
        '<div class="apoio-ou">OU</div>' +
        '<div class="apoio-paypal"><a class="btn" ' +
          (APOIO.paypal ? 'href="' + escapeHTML(APOIO.paypal) + '" rel="noopener" target="_blank"'
                        : 'href="#" aria-disabled="true" data-inerte') +
          ">Doar com PayPal →</a></div>" +

        obrigado + aviso +
        '<p class="apoio-porque">Pagamentos processados pelo Stripe e pelo PayPal. ' +
        "Não recebemos nem guardamos dados do seu cartão.</p>" +
      "</div>";

    hosts.forEach(function (h) { h.innerHTML = html; });

    // Botões ainda sem endereço não navegam nem parecem clicáveis.
    $$("[data-inerte]").forEach(function (a) {
      a.style.opacity = ".55";
      a.style.cursor = "not-allowed";
      a.addEventListener("click", function (ev) { ev.preventDefault(); });
    });
  }

  // ----------------------------------------------------------
  // Fase da Lua (algoritmo local, sem API)
  // ----------------------------------------------------------
  function moonPhase(date) {
    var lp = 2551443; // período sinódico em segundos
    var newMoon = Date.UTC(1970, 0, 7, 20, 35, 0);
    var phase = ((date.getTime() - newMoon) / 1000) % lp;
    var frac = phase / lp;                       // 0 = lua nova
    var illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
    var names = [
      "Lua Nova", "Crescente Côncava", "Quarto Crescente", "Crescente Gibosa",
      "Lua Cheia", "Minguante Gibosa", "Quarto Minguante", "Minguante Côncava"
    ];
    var icons = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
    var idx = Math.floor(frac * 8 + 0.5) % 8;
    return { name: names[idx], icon: icons[idx], illum: Math.round(illum * 100) };
  }

  function renderMoon() {
    var m = moonPhase(new Date());
    set("moon-icon", m.icon);
    set("moon-name", m.name);
    set("moon-illum", m.illum + "% iluminada");
    set("t-moon", m.icon + " " + m.illum + "%");
    set("t-moon-sub", m.name);
  }

  // ----------------------------------------------------------
  // Relógios mundiais
  // ----------------------------------------------------------
  var ZONES = [
    { label: "UTC", tz: "UTC" },
    { label: "Lisboa", tz: "Europe/Lisbon" },
    { label: "Brasília", tz: "America/Sao_Paulo" },
    { label: "Luanda", tz: "Africa/Luanda" },
    { label: "Maputo", tz: "Africa/Maputo" },
    { label: "Tomsk (estação)", tz: "Asia/Tomsk" }
  ];

  function renderClocks() {
    var host = document.getElementById("clocks");
    if (!host) return;
    host.innerHTML = ZONES.map(function (z) {
      var t, dia;
      try {
        t = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: z.tz }).format(new Date());
        dia = new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", month: "short", timeZone: z.tz }).format(new Date());
      } catch (e) { t = "--:--:--"; dia = ""; }
      return '<div class="clock"><b>' + t + "</b><span>" + z.label +
             (dia ? " · " + escapeHTML(dia) : "") + "</span></div>";
    }).join("");
  }

  // ----------------------------------------------------------
  // Imagens que se atualizam sozinhas
  // ----------------------------------------------------------
  function refreshImages() {
    $$("img[data-src]").forEach(function (img) {
      var base = img.getAttribute("data-src");
      img.src = base + (base.indexOf("?") > -1 ? "&" : "?") + "t=" + Date.now();
    });
  }

  function wireImageFallbacks() {
    $$("img[data-src]").forEach(function (img) {
      var hid = img.getAttribute("data-health");
      img.addEventListener("error", function () {
        if (hid) mark(hid, false);
        var box = img.closest(".spectro-frame") || img.parentElement;
        if (box && !box.querySelector(".img-err")) {
          var p = document.createElement("p");
          p.className = "err img-err";
          p.style.padding = "18px";
          p.textContent = "Imagem temporariamente indisponível, a estação de origem pode estar offline.";
          box.appendChild(p);
        }
      });
      img.addEventListener("load", function () {
        if (hid) mark(hid, true);
        var box = img.closest(".spectro-frame") || img.parentElement;
        var e = box && box.querySelector(".img-err");
        if (e) e.remove();
      });
    });
  }

  // ----------------------------------------------------------
  // Data do dia + navegação móvel
  // ----------------------------------------------------------
  function renderDate() {
    var txt = fmtDatePT(new Date());
    var el = document.getElementById("today-date");
    if (el) el.textContent = txt;
    $$("[data-today]").forEach(function (e) { e.textContent = txt; });
    $$("[data-year]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
  }

  function wireNav() {
    var btn = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".nav");
    if (btn && nav) {
      btn.addEventListener("click", function () {
        nav.classList.toggle("open");
        btn.setAttribute("aria-expanded", nav.classList.contains("open") ? "true" : "false");
      });
    }
  }

  function wireNewsletter() {
    var form = document.getElementById("newsletter");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      // Enquanto não houver serviço de e-mail ligado, evita perder o contacto.
      if (form.getAttribute("action")) return; // já configurado, deixa submeter
      ev.preventDefault();
      var msg = document.getElementById("newsletter-msg");
      if (msg) msg.textContent = "Subscrição ainda não ativa. Configure o serviço de e-mail no atributo action deste formulário.";
    });
  }

  // ----------------------------------------------------------
  // Arranque
  // ----------------------------------------------------------
  function loadAll() {
    // Cada página só pede o que mostra. Evita descarregar dados e imagens
    // pesadas em páginas que não os apresentam.
    loadKp(); loadAlerts(); loadScales();
    loadKpForecastLine(); loadForecastDays();

    if (document.getElementById("xray-chart") || document.getElementById("t-xray")) loadXray();
    if (document.getElementById("flare-list") || document.getElementById("t-flare")) loadFlares();
    if (document.getElementById("quake-list") || document.getElementById("t-quakes")) loadQuakes();
    if (document.getElementById("forecast-raw")) loadForecast();
    if (document.getElementById("proton-chart")) loadProtons();
    if (document.getElementById("vs-chart")) loadVentoSolar();
    if (document.getElementById("f107-value")) loadF107();
    if (document.getElementById("quake-map")) { loadQuakes48(); loadVulcoes(); }
    if (document.getElementById("spectro-updated")) probeSpectroAge();
  }

  function init() {
    wireNav();
    wireNewsletter();
    renderDate();
    renderMoon();
    renderClocks();
    renderApoio();
    wirePulso();
    wireImageFallbacks();
    renderHealth();
    refreshImages();
    renderSolarTabs();
    mostrarVistaSolar();
    wireLightbox();
    wireRefresh();
    wireMapaTabs();
    renderQuakeMap();

    if (document.getElementById("gauge-svg")) {
      loadAll();
      setInterval(loadAll, REFRESH_MS);
      setInterval(refreshImages, IMG_REFRESH_MS);
      setInterval(renderClocks, 1000);
      setInterval(renderHealth, 30000); // mantém os "há X min" corretos
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

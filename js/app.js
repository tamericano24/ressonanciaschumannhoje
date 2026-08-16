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
    // Valor numérico extraído desse espectrograma pelo ler-schumann.py, que
    // corre de 30 em 30 minutos e publica na branch "dados". Fica fora do
    // projeto de propósito, para o histórico não encher de commits do robô.
    schumann: "https://raw.githubusercontent.com/tamericano24/ressonanciaschumannhoje/dados/schumann.json",
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

    // O medidor grande mostra a Ressonancia de Schumann, nao este composto.
    // Ver renderSchumann(). O composto fica no mosaico, identificado como tal.
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
        '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="5"/>' +
        ticks +
        '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="' + color + '" stroke-width="5" ' +
          'stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" ' +
          'transform="rotate(-90 100 100)" style="transition:stroke-dashoffset .9s ease;filter:drop-shadow(0 0 6px ' + color + '55)"/>' +
      "</svg>";
  }

  /* ---------------- Ressonância de Schumann, medida ----------------
     O valor vem de ler-schumann.py, que lê o espectrograma da estação de
     Tomsk de 30 em 30 minutos e publica o resultado na branch "dados".

     Quando o recetor está saturado, quando ainda não há dados da hora, ou
     quando a leitura não é de confiança, NÃO se mostra número nenhum: mostra-se
     o motivo. Um quarto das horas do dia é assim, e inventar um valor para
     tapar o buraco seria mentir ao visitante. Ver metodologia.html            */

  var SR_MOTIVOS = {
    saturado:            "recetor saturado em Tomsk",
    sem_dados:           "ainda sem dados desta hora",
    pico_no_limite:      "leitura sem confiança",
    sem_correspondencia: "leitura sem confiança",
    formato_desconhecido: "a fonte mudou de formato",
    fonte_indisponivel:  "fonte indisponível"
  };

  // Os mesmos motivos, na forma que encaixa em "a estação está ... desde então".
  var SR_DESDE = {
    saturado:            "com o recetor saturado",
    sem_dados:           "sem dados novos",
    pico_no_limite:      "sem leitura de confiança",
    sem_correspondencia: "sem leitura de confiança"
  };

  // O anel é sempre ciano. A intensidade do espectrograma não é uma escala de
  // gravidade: 78 é um valor corrente, não um alarme. Pintá-la de laranja ou
  // vermelho, como se faz no índice composto, daria ao visitante uma ideia de
  // perigo que a medição não sustenta.
  var COR_SCHUMANN = "is-mild";

  function idade(horas) {
    var m = Math.round(horas * 60);
    if (m < 60) return "há " + m + " min";
    var h = Math.floor(m / 60), r = m % 60;
    return "há " + h + " h" + (r ? " " + r : "");
  }

  // Nomes dos modos por frequência nominal. O JSON traz "2a harmonica" sem
  // acentos, porque é escrito por um script, e isso não se mostra a ninguém.
  var SR_NOMES = { 14.3: "2.ª harmónica", 20.8: "3.ª harmónica",
                   27.3: "4.ª harmónica", 33.8: "5.ª harmónica" };

  // A frase dos modos medidos, por baixo do espectrograma.
  //
  // Existe uma segunda cópia desta lógica em prerender.py, que escreve a mesma
  // frase dentro do index.html antes de publicar. É deliberado: o Python serve
  // o Google, que às vezes indexa sem correr o JavaScript, e esta versão serve
  // o visitante, que vê o valor do momento. Ao mexer numa, mexer na outra.
  function fraseModos(d) {
    var f = d && d.fundamental;
    if (!d || !f || f.estado !== "ok") {
      return "Sem leitura de confiança neste momento: " +
             ((d && SR_MOTIVOS[d.estado]) || "fonte indisponível") +
             ". Os modos nominais da cavidade Terra-ionosfera são 7,83, 14,3, 20,8, 27,3 e 33,8 Hz.";
    }
    var hz = function (v) { return v.toFixed(2).replace(".", ",") + "&nbsp;Hz"; };
    // Sem "neste momento" aqui: a legenda logo acima já começa assim, e as duas
    // frases aparecem coladas uma à outra por baixo do espectrograma.
    var quando = d.estado === "ultima_conhecida" && d.atraso_horas > 0.5
      ? "Na última medição de confiança, " + idade(d.atraso_horas) + ", o pico da fundamental estava em "
      : "O pico da fundamental está em ";

    var t = quando + "<b>" + hz(f.pico_hz) + "</b>, com intensidade " +
            Math.round(f.intensidade) + " em 100 na escala de cor do espectrograma.";

    var hs = (d.harmonicas || []).filter(function (h) { return h.estado === "ok"; });
    if (hs.length) {
      t += " " + hs.map(function (h) {
        return (SR_NOMES[h.nominal_hz] || h.modo) + " em " + hz(h.pico_hz) +
               " (" + Math.round(h.intensidade) + ")";
      }).join(", ") + ".";
    }
    return t + " Os modos nominais da cavidade Terra-ionosfera são 7,83, 14,3, 20,8, 27,3 e 33,8 Hz.";
  }

  function renderSchumann(d) {
    var f = d && d.fundamental;
    var legenda = document.getElementById("sr-legenda");
    set("sr-modos", fraseModos(d));

    // Só fica sem número se as 72 horas do espectrograma não tiverem uma
    // única medição válida, o que é raro. Fora isso mostra-se sempre a
    // última medição real, dizendo de quando é.
    if (!d || !f || f.estado !== "ok") {
      var motivo = (d && SR_MOTIVOS[d.estado]) || "fonte indisponível";
      drawGauge(0, "is-calm");
      set("idx-value", "?", "gauge-value");
      set("idx-word", "sem leitura", "gauge-unit");
      if (legenda) legenda.textContent = "Pico da fundamental · " + motivo;
      set("t-sr", "?");
      set("t-sr-sub", "sem leitura", "tile-sub");
      set("t-sr-foot", motivo, "tile-foot");
      return;
    }

    var cls = COR_SCHUMANN;
    var velha = d.estado === "ultima_conhecida" && d.atraso_horas > 0.5;

    // Dentro do anel só cabe o essencial: a intensidade em número grande e a
    // frequência do pico por baixo. Tudo o resto (idade, motivo, harmónicas)
    // vai para a legenda, fora do medidor. O .gauge-unit é maiúsculas com
    // espaçamento largo: uma frase ali dentro transborda por cima do anel.
    drawGauge(f.intensidade, cls);
    set("idx-value", String(Math.round(f.intensidade)), "gauge-value " + cls);
    set("idx-word", f.pico_hz.toFixed(2).replace(".", ",") + " Hz", "gauge-unit " + cls);

    // Uma linha curta, discreta. O detalhe todo (harmónicas, escala, regras de
    // recusa) vive na metodologia: debaixo do medidor só cabe o essencial, sob
    // pena de sujar a parte mais vista do painel.
    if (legenda) {
      legenda.textContent = velha
        ? "Pico da fundamental · última medição " + idade(d.atraso_horas) + ", Tomsk " +
          (SR_DESDE[d.motivo_do_atraso] || "sem dados novos") + " desde então"
        : "Pico da fundamental · medição atual da estação de Tomsk";
    }

    // O mesmo valor no mosaico, para o painel não dizer duas coisas diferentes.
    set("t-sr", String(Math.round(f.intensidade)));
    set("t-sr-sub", f.pico_hz.toFixed(2).replace(".", ",") + " Hz", "tile-sub");
    set("t-sr-foot", velha ? "Última medição " + idade(d.atraso_horas) + " · Tomsk"
                           : "Pico da fundamental · Tomsk", "tile-foot");
  }

  function carregarSchumann() {
    return getJSON(SRC.schumann).then(renderSchumann).catch(function () {
      renderSchumann(null);
    });
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
      set("t-kp", num(last.v), "tile-value " + info.cls);
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
      set("t-xray", info.txt, "tile-value " + info.cls);
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
      set("t-flare", ultima.max_class ? decPT(ultima.max_class) : "…", "tile-value " + clsU);
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
      set("t-quakes", String(feats.length), "tile-value " + (feats.length ? "is-mild" : "is-calm"));
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

  // ----------------------------------------------------------
  // Leitura das mensagens de alerta da NOAA
  //
  // O corpo da mensagem começa com campos de cabeçalho
  // ("Space Weather Message Code: WARK04", "Serial Number", ...). A frase
  // que interessa está numa linha que começa por ALERT, WARNING, WATCH ou
  // SUMMARY. Antes lia-se a primeira linha, o que fazia aparecer o código
  // interno em vez do aviso.
  // ----------------------------------------------------------

  var TRADUZ_ALERTA = [
    [/^Geomagnetic K-index of (\d+) or greater expected/i, "Índice K geomagnético de $1 ou superior esperado"],
    [/^Geomagnetic K-index of (\d+) expected/i, "Índice K geomagnético de $1 esperado"],
    [/^Geomagnetic K-index of (\d+)$/i, "Índice K geomagnético de $1"],
    [/^Geomagnetic Storm Category (G\d) (?:Predicted|Observed)/i, "Tempestade geomagnética $1"],
    [/^Radio Blackout( Type)? (R\d)/i, "Apagão de rádio $2"],
    [/^X-?ray Flux exceeded (M\d|X\d)/i, "Fluxo de raios-X acima de $1"],
    [/^Proton Event .*?Threshold/i, "Evento de protões acima do limiar"],
    [/^Electron .*?Flux .*?exceeded/i, "Fluxo de eletrões acima do limiar"],
    [/^Solar Radiation Storm Category (S\d)/i, "Tempestade de radiação solar $1"],
    [/^Type (II|IV) Radio Emission/i, "Emissão de rádio tipo $1"],
    [/^Continued .*/i, "Continuação do aviso anterior"]
  ];

  function resumoAlerta(mensagem) {
    var linhas = String(mensagem || "").split("\n").map(function (l) { return l.trim(); });

    // procura a linha do aviso propriamente dito
    var frase = "";
    for (var i = 0; i < linhas.length; i++) {
      var m = linhas[i].match(/^(ALERT|WARNING|WATCH|SUMMARY|EXTENDED WARNING|CANCEL WARNING)\s*:\s*(.+)$/i);
      if (m) { frase = m[2].trim(); break; }
    }

    // sem essa linha, usa a primeira que não seja um campo de cabeçalho
    if (!frase) {
      for (var k = 0; k < linhas.length; k++) {
        if (linhas[k] && !/^[A-Za-z ]{3,30}:/.test(linhas[k])) { frase = linhas[k]; break; }
      }
    }
    if (!frase) return "Aviso de clima espacial da NOAA";

    for (var t = 0; t < TRADUZ_ALERTA.length; t++) {
      if (TRADUZ_ALERTA[t][0].test(frase)) {
        return frase.replace(TRADUZ_ALERTA[t][0], TRADUZ_ALERTA[t][1]);
      }
    }
    return frase;
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
        return '<li><span class="k">' + (d ? pad(d.getUTCDate()) + "/" + pad(d.getUTCMonth() + 1) : "…") +
               '</span><span>' + escapeHTML(resumoAlerta(r.message)) + "</span></li>";
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

  // ----------------------------------------------------------
  // De que país é este sismo
  //
  // O USGS e a NASA dão sempre o sítio em inglês, com o país ou o estado
  // depois da última vírgula: "78 km SE of Ende, Indonesia". A deteção corre
  // sobre o texto original, antes de ser traduzido, porque o inglês é
  // constante e a tradução não.
  //
  // Sem correspondência exata não se atribui país nenhum. Muitos sismos são
  // em mar aberto ("Southern East Pacific Rise") e não pertencem a lado
  // nenhum: pôr ali a bandeira do país mais próximo seria inventar.
  // ----------------------------------------------------------

  var ISO = {
    // Cintura de fogo e resto do mundo sísmico
    Japan: "JP", Philippines: "PH", Indonesia: "ID", Russia: "RU", Mexico: "MX",
    "New Zealand": "NZ", "Papua New Guinea": "PG", Greece: "GR", Turkey: "TR",
    Italy: "IT", Colombia: "CO", Ecuador: "EC", Nicaragua: "NI", India: "IN",
    "Solomon Islands": "SB", Iran: "IR", Afghanistan: "AF", Pakistan: "PK",
    Chile: "CL", Peru: "PE", China: "CN", Taiwan: "TW", Fiji: "FJ", Tonga: "TO",
    Vanuatu: "VU", Guatemala: "GT", "El Salvador": "SV", "Costa Rica": "CR",
    Argentina: "AR", Bolivia: "BO", Panama: "PA", "Dominican Republic": "DO",
    Iceland: "IS", Norway: "NO", Morocco: "MA", Algeria: "DZ", Ethiopia: "ET",
    Myanmar: "MM", Malaysia: "MY", Nepal: "NP", Cyprus: "CY", Canada: "CA",
    Spain: "ES", Portugal: "PT", France: "FR", Romania: "RO", Bulgaria: "BG",
    Albania: "AL", Croatia: "HR", Georgia: "GE", Armenia: "AM", Azerbaijan: "AZ",
    Kazakhstan: "KZ", Kyrgyzstan: "KG", Tajikistan: "TJ", Bangladesh: "BD",
    Thailand: "TH", Vietnam: "VN", "South Korea": "KR", "North Korea": "KP",
    Mongolia: "MN", Australia: "AU", Venezuela: "VE", Brazil: "BR",
    Honduras: "HN", Cuba: "CU", Jamaica: "JM", Haiti: "HT", Egypt: "EG",
    Tanzania: "TZ", Kenya: "KE", Congo: "CD", Yemen: "YE", Oman: "OM",
    Iraq: "IQ", Syria: "SY", Israel: "IL", Lebanon: "LB", Jordan: "JO",
    Tunisia: "TN", Libya: "LY", "South Africa": "ZA", Madagascar: "MG",
    "East Timor": "TL", "Timor Leste": "TL", "Sri Lanka": "LK", Bhutan: "BT",
    Serbia: "RS", "Bosnia and Herzegovina": "BA", Montenegro: "ME",
    "North Macedonia": "MK", Slovenia: "SI", Austria: "AT", Switzerland: "CH",
    Germany: "DE", Poland: "PL", Ukraine: "UA", "United Kingdom": "GB",
    Ireland: "IE", Sweden: "SE", Finland: "FI", Denmark: "DK",
    Uzbekistan: "UZ", Turkmenistan: "TM", "Saudi Arabia": "SA",
    "United Arab Emirates": "AE", Qatar: "QA", Cameroon: "CM", Uganda: "UG",
    Mozambique: "MZ", Malawi: "MW", Zambia: "ZM", Zimbabwe: "ZW",
    Eritrea: "ER", Djibouti: "DJ", Somalia: "SO", Sudan: "SD", Chad: "TD",
    Mali: "ML", Niger: "NE", Nigeria: "NG", Ghana: "GH", Guinea: "GN",
    Uruguay: "UY", Paraguay: "PY", Suriname: "SR", Guyana: "GY",
    Belize: "BZ", "Trinidad and Tobago": "TT", Barbados: "BB",

    // Territórios com bandeira própria, que o USGS nomeia à parte
    "Puerto Rico": "PR", Greenland: "GL", "New Caledonia": "NC",
    "French Polynesia": "PF", Guam: "GU", "U.S. Virgin Islands": "VI",
    "British Virgin Islands": "VG", "Cayman Islands": "KY", Bermuda: "BM",
    "Faroe Islands": "FO", Gibraltar: "GI", Samoa: "WS", "American Samoa": "AS",
    "Cook Islands": "CK", Niue: "NU", Palau: "PW", Micronesia: "FM",
    "Marshall Islands": "MH", Kiribati: "KI", Nauru: "NR", Tuvalu: "TV",

    // Estados dos Estados Unidos: o USGS escreve o estado, não o país
    Alaska: "US", California: "US", Hawaii: "US", Nevada: "US", Washington: "US",
    Oregon: "US", Idaho: "US", Montana: "US", Utah: "US", Wyoming: "US",
    Oklahoma: "US", Texas: "US", Arkansas: "US", Missouri: "US", Tennessee: "US",
    Kansas: "US", Colorado: "US", Arizona: "US", "New Mexico": "US",
    Illinois: "US", Kentucky: "US", Maine: "US", "New York": "US",
    "South Carolina": "US", "North Carolina": "US", Virginia: "US",
    // "Georgia" fica de fora: é ao mesmo tempo o país e um estado dos EUA, e
    // o USGS escreve as duas da mesma maneira. Fica o país, que é o caso
    // sísmico a sério; a Geórgia americana quase não aparece nestes dados.
    Nebraska: "US", "South Dakota": "US", "North Dakota": "US",
    Wisconsin: "US", Michigan: "US", Ohio: "US", Alabama: "US",
    Mississippi: "US", Louisiana: "US", Florida: "US", Minnesota: "US",
    Iowa: "US", Indiana: "US", "West Virginia": "US", Pennsylvania: "US",
    "New Jersey": "US", Massachusetts: "US", Connecticut: "US",
    "Rhode Island": "US", Vermont: "US", "New Hampshire": "US", Delaware: "US",
    Maryland: "US",

    // Ilhas soltas que pertencem a um país e o USGS nomeia sem o dizer
    "Kermadec Islands": "NZ", "Kuril Islands": "RU", "Bonin Islands": "JP",
    "Volcano Islands": "JP", "Ryukyu Islands": "JP", "Izu Islands": "JP",
    // As Balleny são antárticas e não são de ninguém: null diz "conhecida, e
    // sem país", que é diferente de não estar na lista.
    "Balleny Islands": null, "Andreanof Islands": "US", "Fox Islands": "US",
    "Rat Islands": "US", "Near Islands": "US", "Aleutian Islands": "US",
    "Canary Islands": "ES", Azores: "PT", "Cape Verde": "CV",
    "Macquarie Island": "AU", "Easter Island": "CL", "Galapagos Islands": "EC",
    "Svalbard": "NO", "Jan Mayen": "NO",

    // As redes regionais do USGS escrevem a sigla do estado em vez do nome:
    // "19 km SW of Toms Place, CA". São siglas de estados, não códigos de
    // país: aqui dentro "CA" é a Califórnia e nunca o Canadá, porque o USGS
    // escreve os países por extenso. Só valem para o texto que vem do USGS.
    AK: "US", AL: "US", AR: "US", AZ: "US", CA: "US", CO: "US", CT: "US",
    DE: "US", FL: "US", GA: "US", HI: "US", IA: "US", ID: "US", IL: "US",
    IN: "US", KS: "US", KY: "US", LA: "US", MA: "US", MD: "US", ME: "US",
    MI: "US", MN: "US", MO: "US", MS: "US", MT: "US", NC: "US", ND: "US",
    NE: "US", NH: "US", NJ: "US", NM: "US", NV: "US", NY: "US", OH: "US",
    OK: "US", OR: "US", PA: "US", RI: "US", SC: "US", SD: "US", TN: "US",
    TX: "US", UT: "US", VA: "US", VT: "US", WA: "US", WI: "US", WV: "US",
    WY: "US", PR: "PR", MX: "MX"
  };

  // Nome em português para mostrar por baixo da bandeira.
  var ISO_NOME = {
    JP: "Japão", PH: "Filipinas", ID: "Indonésia", RU: "Rússia", MX: "México",
    NZ: "Nova Zelândia", PG: "Papua-Nova Guiné", GR: "Grécia", TR: "Turquia",
    IT: "Itália", CO: "Colômbia", EC: "Equador", NI: "Nicarágua", IN: "Índia",
    SB: "Ilhas Salomão", IR: "Irão", AF: "Afeganistão", PK: "Paquistão",
    CL: "Chile", PE: "Peru", CN: "China", TW: "Taiwan", FJ: "Fiji", TO: "Tonga",
    VU: "Vanuatu", GT: "Guatemala", SV: "Salvador", CR: "Costa Rica",
    AR: "Argentina", BO: "Bolívia", PA: "Panamá", DO: "República Dominicana",
    IS: "Islândia", NO: "Noruega", MA: "Marrocos", DZ: "Argélia", ET: "Etiópia",
    MM: "Mianmar", MY: "Malásia", NP: "Nepal", CY: "Chipre", CA: "Canadá",
    ES: "Espanha", PT: "Portugal", FR: "França", RO: "Roménia", BG: "Bulgária",
    AL: "Albânia", HR: "Croácia", GE: "Geórgia", AM: "Arménia", AZ: "Azerbaijão",
    KZ: "Cazaquistão", KG: "Quirguistão", TJ: "Tajiquistão", BD: "Bangladexe",
    TH: "Tailândia", VN: "Vietname", KR: "Coreia do Sul", KP: "Coreia do Norte",
    MN: "Mongólia", AU: "Austrália", VE: "Venezuela", BR: "Brasil",
    HN: "Honduras", CU: "Cuba", JM: "Jamaica", HT: "Haiti", EG: "Egito",
    TZ: "Tanzânia", KE: "Quénia", CD: "Congo", YE: "Iémen", OM: "Omã",
    IQ: "Iraque", SY: "Síria", IL: "Israel", LB: "Líbano", JO: "Jordânia",
    TN: "Tunísia", LY: "Líbia", ZA: "África do Sul", MG: "Madagáscar",
    TL: "Timor-Leste", LK: "Sri Lanca", BT: "Butão", RS: "Sérvia",
    BA: "Bósnia e Herzegovina", ME: "Montenegro", MK: "Macedónia do Norte",
    SI: "Eslovénia", AT: "Áustria", CH: "Suíça", DE: "Alemanha", PL: "Polónia",
    UA: "Ucrânia", GB: "Reino Unido", IE: "Irlanda", SE: "Suécia",
    FI: "Finlândia", DK: "Dinamarca", UZ: "Usbequistão", TM: "Turquemenistão",
    SA: "Arábia Saudita", AE: "Emirados Árabes Unidos", QA: "Catar",
    CM: "Camarões", UG: "Uganda", MZ: "Moçambique", MW: "Maláui",
    ZM: "Zâmbia", ZW: "Zimbabué", ER: "Eritreia", DJ: "Jibuti", SO: "Somália",
    SD: "Sudão", TD: "Chade", ML: "Mali", NE: "Níger", NG: "Nigéria",
    GH: "Gana", GN: "Guiné", UY: "Uruguai", PY: "Paraguai", SR: "Suriname",
    GY: "Guiana", BZ: "Belize", TT: "Trindade e Tobago", BB: "Barbados",
    US: "Estados Unidos", PR: "Porto Rico", GL: "Gronelândia",
    NC: "Nova Caledónia", PF: "Polinésia Francesa", GU: "Guam",
    VI: "Ilhas Virgens Americanas", VG: "Ilhas Virgens Britânicas",
    KY: "Ilhas Caimão", BM: "Bermudas", FO: "Ilhas Faroé", GI: "Gibraltar",
    WS: "Samoa", AS: "Samoa Americana", CK: "Ilhas Cook", NU: "Niue",
    PW: "Palau", FM: "Micronésia", MH: "Ilhas Marshall", KI: "Quiribáti",
    NR: "Nauru", TV: "Tuvalu", CV: "Cabo Verde"
  };

  // A bandeira do país, à frente do sítio, na lista de sismos e na de vulcões.
  //
  // NÃO trocar isto por emoji de bandeira. O Windows não traz os desenhos das
  // bandeiras na Segoe UI Emoji, e o que aparece no Chrome e no Edge são as
  // duas letras do código. Os desenhos vêm do js/bandeiras.js, feitos aqui.
  //
  // Um país que o js/bandeiras.js não saiba desenhar fica com o código em
  // letras, e um sítio em mar aberto fica com um traço. Não se põe ali a
  // bandeira do país mais próximo: dez por cento dos sismos são no meio do
  // oceano e não são de ninguém.
  function bandeira(pais) {
    if (!pais) {
      return '<span class="pais pais--nenhum" title="Em mar aberto, fora de qualquer país">—</span>';
    }
    var svg = window.BANDEIRA_SVG ? window.BANDEIRA_SVG(pais.iso) : "";
    return '<span class="pais' + (svg ? "" : " pais--codigo") + '" title="' + escapeHTML(pais.nome) + '">' +
           (svg || escapeHTML(pais.iso)) + "</span>";
  }

  // Recebe o texto original em inglês do USGS ou da EONET.
  function paisDe(place) {
    if (!place) return null;
    var t = String(place).trim();

    // O que interessa é o que vem depois da última vírgula. Sem vírgula, a
    // frase inteira ainda pode ser o nome de uma região conhecida.
    var cauda = t.indexOf(",") >= 0 ? t.slice(t.lastIndexOf(",") + 1) : t;
    cauda = cauda.replace(/\s+region\s*$/i, "").trim();

    var iso = ISO[cauda];
    if (iso === undefined) iso = ISO[cauda.replace(/^the\s+/i, "")];

    // Sem vírgula ainda pode acabar num sítio conhecido: "west of Macquarie
    // Island". Procura-se um nome da tabela no fim da frase, e nunca no meio,
    // senão "south of the Fiji Islands", que é mar alto, passava por Fiji.
    if (iso === undefined) {
      for (var k in ISO) {
        if (k.length > 4 && cauda.length > k.length && cauda.slice(-k.length) === k) {
          iso = ISO[k];
          break;
        }
      }
    }

    if (!iso) return null;
    return { iso: iso, nome: ISO_NOME[iso] || cauda };
  }

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

  function projX(lon) { return ((lon + 180) / 360) * MAPA_W; }
  function projY(lat) { return ((90 - lat) / 180) * MAPA_H; }

  function corSismo(m) {
    return m >= 6.5 ? "#f43f5e" : m >= 5.5 ? "#fb923c" : m >= 4.5 ? "#fbbf24" : "#38bdf8";
  }

  // Nomes escritos por cima do desenho. Sem isto o mapa é uma silhueta e a
  // pessoa tem de adivinhar o que está a ver. As posições são o centro
  // aproximado de cada massa, escolhidas para não caírem em cima dos pontos
  // da cintura de fogo, que é onde quase tudo acontece.
  var CONTINENTES = [
    { nome: "AMÉRICA DO NORTE", lon: -101, lat: 47 },
    { nome: "AMÉRICA DO SUL",   lon: -60,  lat: -12 },
    { nome: "EUROPA",           lon: 21,   lat: 55 },
    { nome: "ÁFRICA",           lon: 20,   lat: 3 },
    { nome: "ÁSIA",             lon: 88,   lat: 47 },
    { nome: "OCEANIA",          lon: 134,  lat: -26 },
    { nome: "ANTÁRTIDA",        lon: 10,   lat: -78 }
  ];

  var OCEANOS = [
    { nome: "Oceano Pacífico", lon: -145, lat: 8 },
    { nome: "Pacífico",        lon: 168,  lat: 22 },
    { nome: "Oceano Atlântico", lon: -33, lat: 22 },
    { nome: "Oceano Índico",   lon: 78,   lat: -28 }
  ];

  function texto(t, lon, lat, cor, tam, esp, italico) {
    return '<text x="' + projX(lon).toFixed(1) + '" y="' + projY(lat).toFixed(1) +
      '" fill="' + cor + '" font-size="' + tam + '" letter-spacing="' + esp +
      '" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif"' +
      (italico ? ' font-style="italic"' : ' font-weight="600"') +
      ' pointer-events="none">' + escapeHTML(t) + "</text>";
  }

  // O fundo do mapa: oceano, grelha, terra e nomes. É igual nos dois mapas,
  // o dos sismos e o dos vulcões, por isso vive numa função só.
  function fundoDoMapa() {
    var s = '<defs>' +
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

    // O equador leva tracejado e nome, que é a referência que toda a gente
    // reconhece e ajuda a ler a latitude do resto.
    s += '<line x1="0" y1="' + (MAPA_H / 2) + '" x2="' + MAPA_W + '" y2="' + (MAPA_H / 2) +
         '" stroke="rgba(125,180,235,.14)" stroke-dasharray="5 7"/>';
    s += '<text x="6" y="' + (MAPA_H / 2 - 3) + '" fill="rgba(125,180,235,.4)" font-size="6.5" ' +
         'letter-spacing="1.2" font-family="Segoe UI, system-ui, sans-serif" pointer-events="none">EQUADOR</text>';

    OCEANOS.forEach(function (o) {
      s += texto(o.nome, o.lon, o.lat, "rgba(125,180,235,.30)", 8, 0.6, true);
    });

    if (window.MAPA_MUNDO) {
      s += '<path d="' + window.MAPA_MUNDO + '" fill="#15243a" stroke="#4a7ba8" stroke-width=".7" ' +
           'stroke-linejoin="round" stroke-opacity=".8"/>';
    }

    CONTINENTES.forEach(function (c) {
      s += texto(c.nome, c.lon, c.lat, "rgba(174,205,238,.52)", 8.5, 1.3);
    });

    return s;
  }

  // Cada mapa guarda as suas marcas à parte. Antes havia uma lista só, e com
  // dois mapas na mesma página o segundo apagava as marcas do primeiro.
  var marcasPorMapa = {};

  function camadaSismos(s, marcas) {
    // Raio proporcional à raiz da energia, sem desfoque: o desfoque
    // transformava os pontos em manchas sobrepostas.
    dadosMapa.sismos.slice().sort(function (a, b) {
      return (a.properties.mag || 0) - (b.properties.mag || 0);
    }).forEach(function (f) {
      var c = f.geometry && f.geometry.coordinates;
      if (!c) return;
      var m = f.properties.mag || 0;
      var r = Math.max(2.2, Math.pow(Math.max(m - 2, 0.2), 1.45) * 1.25);
      var cor = corSismo(m);
      var i = marcas.length;
      var pais = paisDe(f.properties.place);

      marcas.push({
        tipo: "sismo", x: projX(c[0]), y: projY(c[1]), r: r,
        titulo: "M" + num(m) + " · " + traduzLocal(f.properties.place),
        linhas: [
          (pais ? pais.nome : "Em mar aberto, fora de qualquer país"),
          (c[2] != null ? Math.round(c[2]) + " km de profundidade" : "profundidade desconhecida"),
          ago(new Date(f.properties.time))
        ],
        cor: cor
      });

      if (m >= 5.5) {
        s.v += '<circle cx="' + projX(c[0]).toFixed(1) + '" cy="' + projY(c[1]).toFixed(1) +
             '" r="' + (r * 2.1).toFixed(1) + '" fill="' + cor + '" fill-opacity=".13"/>';
      }
      s.v += '<circle class="mk" data-i="' + i + '" cx="' + projX(c[0]).toFixed(1) + '" cy="' +
           projY(c[1]).toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + cor +
           '" fill-opacity=".85" stroke="#0b1220" stroke-width=".9"/>';
    });
  }

  function camadaVulcoes(s, marcas, grande) {
    var t = grande ? 6.4 : 5;    // no mapa só de vulcões os triângulos são maiores
    dadosMapa.vulcoes.forEach(function (v) {
      var x = projX(v.lon), y = projY(v.lat), i = marcas.length;
      marcas.push({
        tipo: "vulcao", x: x, y: y, r: t,
        titulo: "Vulcão " + traduzLocal(v.nome),
        linhas: [
          (v.pais ? v.pais.nome : "Localização em mar aberto"),
          "em erupção" + (v.desde ? " " + ago(v.desde) : "")
        ],
        cor: "#ff5470"
      });
      if (grande) {
        s.v += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
             '" r="' + (t * 2.2).toFixed(1) + '" fill="#ff5470" fill-opacity=".12"/>';
      }
      s.v += '<path class="mk" data-i="' + i + '" d="M' + x.toFixed(1) + " " + (y - t * 1.04).toFixed(1) +
           "L" + (x + t * 0.9).toFixed(1) + " " + (y + t * 0.68).toFixed(1) +
           "L" + (x - t * 0.9).toFixed(1) + " " + (y + t * 0.68).toFixed(1) + 'Z" ' +
           'fill="#ff5470" fill-opacity=".9" stroke="#0b1220" stroke-width=".8" stroke-linejoin="round"/>';
    });
  }

  // hostId: "quake-map" ou "volcano-map". Cada um desenha só a sua camada.
  function renderMapa(hostId, camadas) {
    var host = document.getElementById(hostId);
    if (!host) return;

    var marcas = [];
    var s = { v: fundoDoMapa() };

    if (camadas.sismos) camadaSismos(s, marcas);
    if (camadas.vulcoes) camadaVulcoes(s, marcas, !camadas.sismos);

    s.v += '<circle class="mk-foco" r="0" fill="none" stroke="#fff" stroke-width="1.6" opacity="0" pointer-events="none"/>';

    marcasPorMapa[hostId] = marcas;
    host.innerHTML = '<svg viewBox="0 0 ' + MAPA_W + " " + MAPA_H + '" role="img" aria-label="' +
      (camadas.sismos ? "Mapa mundial dos sismos das últimas 48 horas"
                      : "Mapa mundial dos vulcões em erupção") + '">' + s.v + "</svg>";

    ligaInfoMapa(host);
  }

  function renderQuakeMap() { renderMapa("quake-map", { sismos: true }); }
  function renderVolcanoMap() { renderMapa("volcano-map", { vulcoes: true }); }

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

    host.innerHTML = lista.map(function (f) {
      var p = f.properties, c = f.geometry.coordinates;
      var m = p.mag || 0;
      return '<li data-lon="' + c[0] + '" data-lat="' + c[1] + '" title="Clique para centrar no mapa">' +
        '<span class="mag" style="color:' + corSismo(m) + '">M' + num(m) + "</span>" +
        bandeira(paisDe(p.place)) +
        '<span class="loc">' + escapeHTML(traduzLocal(p.place)) + "</span>" +
        '<span class="qd">' + (c[2] != null ? Math.round(c[2]) + " km · " : "") + ago(new Date(p.time)) + "</span></li>";
    }).join("");

    // Passar o rato numa linha acende a marca correspondente no mapa.
    $$("#quake-feed li[data-lon]").forEach(function (li) {
      li.addEventListener("mouseenter", function () { focaMarca("quake-map", +li.dataset.lon, +li.dataset.lat, true); });
      li.addEventListener("mouseleave", function () { focaMarca("quake-map", null); });
      li.addEventListener("click", function () {
        $$("#quake-feed li.on").forEach(function (o) { o.classList.remove("on"); });
        li.classList.add("on");
        var mapa = document.getElementById("quake-map");
        if (mapa) mapa.scrollIntoView({ block: "nearest", behavior: "smooth" });
        focaMarca("quake-map", +li.dataset.lon, +li.dataset.lat, true);
      });
    });
  }

  // ----------------------------------------------------------
  // Caixa de informação que segue o rato sobre o mapa
  // ----------------------------------------------------------

  // Realça no mapa indicado a marca que está nestas coordenadas.
  function focaMarca(hostId, lon, lat, mostrarCaixa) {
    var host = document.getElementById(hostId);
    if (!host) return;
    var svg = host.querySelector("svg");
    var foco = svg && svg.querySelector(".mk-foco");
    var tip = host.querySelector(".map-tip");
    if (!foco) return;

    if (lon === null || lon === undefined) {
      foco.setAttribute("opacity", "0");
      if (tip) tip.hidden = true;
      return;
    }

    var x = projX(lon), y = projY(lat), alvo = null, dMin = Infinity;
    (marcasPorMapa[hostId] || []).forEach(function (m) {
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
    var foco = svg.querySelector(".mk-foco");
    var marcas = marcasPorMapa[host.id] || [];

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

  // As abas "Tudo / Só sismos / Só vulcões" desapareceram: cada um dos dois
  // mapas mostra agora uma coisa só, e uma aba para filtrar um mapa que já
  // está filtrado não servia nada.

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

  // Lista dos vulcões, ligada ao mapa dos vulcões da mesma maneira que a
  // lista dos sismos está ligada ao mapa dos sismos.
  function renderVolcanoList() {
    var host = document.getElementById("volcano-list");
    if (!host) return;

    if (!dadosMapa.vulcoes.length) {
      host.innerHTML = '<li class="muted">Sem erupções ativas registadas no momento.</li>';
      return;
    }

    host.innerHTML = dadosMapa.vulcoes.map(function (v) {
      return '<li data-lon="' + v.lon + '" data-lat="' + v.lat + '" title="Clique para centrar no mapa">' +
        '<span class="vmk">▲</span>' + bandeira(v.pais) +
        '<span class="loc">' + escapeHTML(traduzLocal(v.nome)) + "</span>" +
        '<span class="qd">' + (v.desde ? "desde " + ago(v.desde) : "") + "</span></li>";
    }).join("");

    $$("#volcano-list li[data-lon]").forEach(function (li) {
      li.addEventListener("mouseenter", function () { focaMarca("volcano-map", +li.dataset.lon, +li.dataset.lat, true); });
      li.addEventListener("mouseleave", function () { focaMarca("volcano-map", null); });
      li.addEventListener("click", function () {
        $$("#volcano-list li.on").forEach(function (o) { o.classList.remove("on"); });
        li.classList.add("on");
        var mapa = document.getElementById("volcano-map");
        if (mapa) mapa.scrollIntoView({ block: "nearest", behavior: "smooth" });
        focaMarca("volcano-map", +li.dataset.lon, +li.dataset.lat, true);
      });
    });
  }

  // Vulcões em erupção, NASA EONET
  function loadVulcoes() {
    return getJSON(SRC.vulcoes).then(function (j) {
      var evs = j.events || [];
      dadosMapa.vulcoes = evs.map(function (e) {
        var g = e.geometry && e.geometry[e.geometry.length - 1];
        var c = g && g.coordinates;
        if (!c) return null;
        var titulo = String(e.title || "");
        return {
          nome: titulo.replace(/\s*\bVolcano\b/i, "").replace(/\s+,/g, ",").trim(),
          pais: paisDe(titulo),
          lon: c[0], lat: c[1],
          desde: g.date ? parseUTC(g.date) : null
        };
      }).filter(Boolean);

      // Do mais recente para o mais antigo: uma erupção que começou ontem
      // interessa mais do que uma que dura há três anos.
      dadosMapa.vulcoes.sort(function (a, b) { return (b.desde || 0) - (a.desde || 0); });

      set("volcano-count", String(dadosMapa.vulcoes.length));
      renderVolcanoList();
      renderVolcanoMap();
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

    // Agrupado por tema em vez de uma frase única com oito factos separados
    // por ponto e vírgula, que ninguém lê até ao fim. O conteúdo é o mesmo e
    // continua a vir todo dos dados ao vivo: nenhuma linha aparece sem o dado.
    var sol = [];
    if (resumo.xray) sol.push("fluxo de raios-X <b>" + resumo.xray + "</b>");
    if (resumo.flare) sol.push("última erupção <b>" + resumo.flare + "</b> " + resumo.flareQuando);
    if (resumo.vento) sol.push("vento solar a <b>" + resumo.vento + "</b>");
    if (resumo.protao) sol.push("protões em <b>" + resumo.protao + "</b>");

    var terra = [];
    terra.push("campo geomagnético <b>" + info.label.toLowerCase() + "</b> (Kp " + num(state.kp) + ")");
    if (resumo.energia !== undefined) {
      terra.push("índice de energia <b>" + resumo.energia + " em 100</b> (" + resumo.palavra.toLowerCase() + ")");
    }
    if (resumo.sismos !== undefined) {
      terra.push("<b>" + resumo.sismos + "</b> sismos M4,5+ em 24 h" +
        (resumo.sismoMax ? " (máximo M" + num(resumo.sismoMax) + ")" : ""));
    }

    var registo = [];
    // resumo.espectro já traz "X h de 72 h preenchidas", não repetir a palavra
    if (resumo.espectro) registo.push("estação de Tomsk, <b>" + resumo.espectro + "</b> em UTC");

    var frases = [];
    if (terra.length) frases.push("Na Terra, " + terra.join(", ") + ".");
    if (sol.length) frases.push("No Sol, " + sol.join(", ") + ".");
    if (registo.length) frases.push("O registo vem da " + registo.join("") + ".");

    el.innerHTML =
      "<h3>Como está o planeta agora</h3>" +
      "<p>" + frases.join(" ") + "</p>" +
      '<p class="agora-link"><a href="metodologia.html">Como cada um destes números é medido →</a></p>' +
      '<p class="agora-pe">Atualizado às ' + hhmm(new Date()) + " UTC · " + fmtDatePT(new Date()) + "</p>";
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
  //   2. Cole os endereços nos campos abaixo
  //
  // Enquanto os campos estiverem vazios, os botões ficam inertes e o site
  // mostra um aviso a dizer que ainda não estão ligados. É de propósito:
  // um botão de donativo que não faz nada é pior do que não ter botão.
  //
  // Só Stripe. O PayPal foi retirado por decisão do autor, não por falta de
  // endereço: não voltar a pô-lo sem ele pedir.
  // ==========================================================

  var APOIO = {
    moeda: "€",
    meta: 50,                // meta mensal, em euros
    angariado: 10,           // valor recebido este mês. null = ainda por ligar.
                             // Atualizar à mão a cada donativo, e pôr a zero no
                             // dia 1 de cada mês. É um número real: nunca subir
                             // isto sem o dinheiro ter entrado mesmo.
    apoiantes: ["Maria F."], // Só quem autorizar. Nome próprio e a inicial do
                             // apelido, que chega para a pessoa se reconhecer
                             // sem ficar identificável para estranhos.

    // Endereços de pagamento. Deixe vazio o que ainda não tiver.
    stripe: {
      "5":  "https://buy.stripe.com/eVqaEZ3vagF362k8tx6sw00",
      "15": "https://buy.stripe.com/fZueVf8Pu74tbmE6lp6sw01",
      "50": "https://buy.stripe.com/4gM6oJ7LqewV0I0fVZ6sw02",
      "livre": "https://buy.stripe.com/28E4gBfdS60p9ewaBF6sw03"
    }
  };

  // O rótulo diz o que o apoio sustenta, não o que custa, e usa as peças do
  // próprio site em vez de comparações de fora ("um café"). A ordem é de
  // âmbito crescente: a medição, depois o arquivo que ela alimenta, depois o
  // painel inteiro. Nenhum dos três está destacado: a escolha é do leitor.
  // Curtos de propósito: os quatro cartões estão lado a lado, e um rótulo de
  // duas linhas ao lado de um de uma linha fica desalinhado. Ao mexer nestes
  // textos, confirmar que continuam a caber numa linha no ecrã largo.
  var TIERS = [
    { v: 5,  rot: "mantém a medição" },
    { v: 15, rot: "mantém as leituras diárias" },
    { v: 50, rot: "mantém o painel no ar" }
  ];

  function renderApoio() {
    // Botão da barra do topo: vai direto ao pagamento de valor à escolha.
    // Sem endereço configurado, mantém-se a apontar para a página de apoio.
    if (APOIO.stripe.livre) {
      $$("[data-apoio-direto]").forEach(function (a) {
        a.href = APOIO.stripe.livre;
        a.target = "_blank";
        a.rel = "noopener";
      });
    }

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

    var ligado = !!(APOIO.stripe["5"] || APOIO.stripe["15"] ||
                    APOIO.stripe["50"] || APOIO.stripe.livre);
    var temValor = typeof APOIO.angariado === "number" && APOIO.angariado >= 0;
    var pct = temValor ? Math.max(0, Math.min(100, (APOIO.angariado / APOIO.meta) * 100)) : 0;

    var valorTxt = temValor
      ? APOIO.moeda + num(APOIO.angariado, 0) + ' <small>de ' + APOIO.moeda + num(APOIO.meta, 0) + "</small>"
      : '<small>meta de ' + APOIO.moeda + num(APOIO.meta, 0) + " este mês</small>";

    // A frase do meio fala do que o apoio sustenta, não do que as coisas custam:
    // é a mesma regra dos rótulos dos valores. Esta linha só passou a aparecer
    // quando o "angariado" deixou de ser null, e ainda dizia "para cobrir
    // domínio e alojamento".
    var nota = temValor
      ? (pct >= 100
          ? "<b>Meta atingida.</b> Obrigado. O que vier a mais fica para o mês seguinte."
          : "Faltam <b>" + APOIO.moeda + num(APOIO.meta - APOIO.angariado, 0) +
            "</b> para a meta deste mês, que é o que mantém o painel gratuito, " +
            "sem anúncios, e com os dados verificados um a um.")
      : "Todos os meses o objetivo é o mesmo: manter o painel gratuito, sem anúncios, e com os dados verificados um a um.";

    var botoes = TIERS.map(function (t) {
      var url = APOIO.stripe[String(t.v)];
      var attrs = url ? 'href="' + escapeHTML(url) + '" rel="noopener"'
                      : 'href="#" aria-disabled="true" data-inerte';
      return '<a class="apoio-tier" ' + attrs + ">" +
             "<b>" + APOIO.moeda + t.v + "</b><span>" + t.rot + "</span></a>";
    }).join("");

    var livre = APOIO.stripe.livre;
    botoes += '<a class="apoio-tier" ' +
      (livre ? 'href="' + escapeHTML(livre) + '" rel="noopener"' : 'href="#" aria-disabled="true" data-inerte') +
      '><b style="font-size:19px">Outro</b><span>valor à escolha</span></a>';

    // A estrela é decoração: leva aria-hidden para os leitores de ecrã não
    // anunciarem "faísca" no meio da frase. Vários nomes ficam separados por
    // ponto médio, que fila melhor do que vírgulas numa linha só.
    var obrigado = APOIO.apoiantes.length
      ? '<p class="apoio-obrigado">Obrigado <span class="apoio-estrela" aria-hidden="true">✨</span> <b>' +
        APOIO.apoiantes.map(escapeHTML).join("</b> · <b>") + "</b></p>"
      : "";

    var aviso = ligado ? "" :
      '<p class="apoio-aviso">Os botões ainda não estão ligados a nenhum sistema de pagamento. ' +
      "Assim que tiver os endereços do Stripe, preencha o bloco <code>APOIO</code> " +
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

        obrigado + aviso +
        '<p class="apoio-porque">Pagamentos processados pelo Stripe. ' +
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

  // ----------------------------------------------------------
  // Painel de navegação
  //
  // Definido uma única vez aqui e injetado em todas as páginas. Assim
  // acrescentar uma página ao site é mudar uma linha, em vez de editar
  // dezasseis ficheiros e esquecer um.
  // ----------------------------------------------------------

  // O grupo "O projeto" foi eliminado. Metodologia subiu para "Aprender", que
  // é onde as pessoas a procuram e é a página que mais credibilidade dá ao
  // site. Sobre, widget, privacidade e termos passaram para a linha de
  // rodapé do painel: são páginas que se visitam uma vez, e ocupavam quatro
  // linhas do mesmo tamanho das que se usam todos os dias.
  //
  // As âncoras do painel ficaram num grupo à parte, "Dentro do painel". Antes
  // estavam misturadas com páginas verdadeiras em "Ao vivo", e não se percebia
  // que umas abrem uma página e outras saltam para um sítio da inicial.
  var MENU = [
    { grupo: "Ao vivo", itens: [
      { ic: "📡", txt: "Painel",             href: "index.html",             nota: "Ao vivo" },
      { ic: "🧭", txt: "Índice Kp agora",    href: "indice-kp-agora.html" },
      { ic: "🌌", txt: "Aurora esta noite",  href: "aurora-esta-noite.html" }
    ]},
    { grupo: "Dentro do painel", itens: [
      { ic: "〰️", txt: "Espectrograma",      href: "index.html#espectrograma" },
      { ic: "🔴", txt: "Mapa sísmico",       href: "index.html#terra" },
      { ic: "🌋", txt: "Mapa vulcânico",     href: "index.html#vulcoes" },
      { ic: "💛", txt: "Como se sente hoje", href: "index.html#pulso" }
    ]},
    { grupo: "Registos", itens: [
      { ic: "📄", txt: "Leituras diárias",   href: "leitura/index.html",     nota: "Diário" },
      { ic: "📅", txt: "Arquivo de 30 dias", href: "arquivo.html" }
    ]},
    { grupo: "Aprender", itens: [
      { ic: "❓", txt: "O que é a Ressonância", href: "blog/o-que-e-a-ressonancia-de-schumann.html" },
      { ic: "🔬", txt: "Como medimos",          href: "metodologia.html" },
      { ic: "🩺", txt: "Sintomas relatados",    href: "sintomas.html" },
      { ic: "📚", txt: "Artigos",               href: "blog/index.html" },
      { ic: "💬", txt: "Perguntas frequentes",  href: "faq.html" }
    ]}
  ];

  // Páginas que se visitam uma vez. Vão para o rodapé do painel, em letra
  // pequena, em vez de ocuparem uma linha inteira cada uma.
  var MENU_RODAPE = [
    { txt: "Widget gratuito", href: "incorporar.html" },
    { txt: "Sobre",           href: "sobre.html" },
    { txt: "Privacidade",     href: "privacidade.html" },
    { txt: "Termos",          href: "termos.html" }
  ];

  // Páginas dentro de blog/ e leitura/ precisam de subir um nível.
  function prefixo() {
    return /\/(blog|leitura)\//.test(location.pathname) ? "../" : "";
  }

  // Caminho da página atual a partir da raiz do site, por exemplo
  // "index.html", "blog/index.html", "leitura/2026-08-05.html".
  // Comparar só o nome do ficheiro não chega: há três "index.html" no site.
  function caminhoAtual() {
    var p = location.pathname.replace(/^\/+/, "");
    if (p === "" || p.slice(-1) === "/") p += "index.html";
    return p;
  }

  function ehPaginaAtual(href) {
    var alvo = href.split("#")[0];
    if (href.indexOf("#") > -1) return false;      // âncoras não marcam página
    var atual = caminhoAtual();
    if (alvo === atual) return true;
    // uma leitura diária mantém aceso o item "Leituras diárias"
    var pasta = alvo.replace(/index\.html$/, "");
    return pasta !== "" && alvo.slice(-10) === "index.html" && atual.indexOf(pasta) === 0;
  }

  function renderMenu() {
    if (document.querySelector(".menu-painel")) return;
    var p = prefixo();

    var corpo = MENU.map(function (g) {
      var itens = g.itens.map(function (it) {
        return '<a class="menu-item' + (ehPaginaAtual(it.href) ? " atual" : "") + '" href="' + p + it.href + '">' +
               '<span class="ic">' + it.ic + "</span><span>" + it.txt + "</span>" +
               (it.nota ? '<span class="nota">' + it.nota + "</span>" : "") + "</a>";
      }).join("");
      return '<div class="menu-grupo">' + g.grupo + '</div><nav class="menu-lista">' + itens + "</nav>";
    }).join("");

    var fundo = document.createElement("div");
    fundo.className = "menu-fundo";
    fundo.hidden = true;

    var painel = document.createElement("aside");
    painel.className = "menu-painel";
    painel.setAttribute("aria-label", "Navegação do site");
    painel.innerHTML =
      '<div class="menu-topo"><b>Ressonância de Schumann</b>' +
        '<button class="menu-fechar" type="button" aria-label="Fechar menu">✕</button></div>' +
      '<div class="menu-vivo">' +
        '<div><span>Ressonância</span><b id="menu-sr">…</b></div>' +
        '<div><span>Índice Kp</span><b id="menu-kp">…</b></div>' +
      "</div>" + corpo +
      '<div class="menu-rodape">' +
        '<a class="btn" data-apoio-direto href="' + p + 'apoiar.html">Apoiar o projeto</a>' +
        '<nav class="menu-secundario">' +
          MENU_RODAPE.map(function (it) {
            return '<a href="' + p + it.href + '">' + it.txt + "</a>";
          }).join("") +
        "</nav>" +
        "<p>Sem publicidade e sem rastreadores</p>" +
      "</div>";

    document.body.appendChild(fundo);
    document.body.appendChild(painel);

    function abrir() {
      fundo.hidden = false;
      requestAnimationFrame(function () {
        fundo.classList.add("aberto");
        painel.classList.add("aberto");
      });
      document.body.classList.add("menu-aberto");
      var bt = painel.querySelector(".menu-fechar");
      if (bt) bt.focus();
      espelhaValoresNoMenu();
    }

    function fechar() {
      fundo.classList.remove("aberto");
      painel.classList.remove("aberto");
      document.body.classList.remove("menu-aberto");
      setTimeout(function () { fundo.hidden = true; }, 260);
    }

    $$(".nav-toggle").forEach(function (b) { b.addEventListener("click", abrir); });
    painel.querySelector(".menu-fechar").addEventListener("click", fechar);
    fundo.addEventListener("click", fechar);
    // A classe do painel só é aplicada no quadro seguinte, por causa da
    // animação. O estado no <body> é definido de imediato, por isso é esse
    // que serve para saber se o menu está aberto.
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && document.body.classList.contains("menu-aberto")) fechar();
    });
    $$(".menu-item", painel).forEach(function (a) { a.addEventListener("click", fechar); });
  }

  // Os dois números no topo do menu.
  //
  // Antes limitavam-se a copiar os valores do painel, e o painel só existe na
  // página inicial: em todas as outras páginas do site ficavam com reticências
  // para sempre. Agora, quando não há painel de onde copiar, vão eles próprios
  // buscar os dados. São dois pedidos pequenos e só acontecem quando alguém
  // abre o menu.
  var menuJaBuscou = false;

  function poeNoMenu(id, valor, cls) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = valor;
    el.className = cls || "";
  }

  function espelhaValoresNoMenu() {
    var kp = document.getElementById("t-kp");
    var sr = document.getElementById("t-sr");
    var kpOk = kp && kp.textContent.trim() !== "…";
    var srOk = sr && sr.textContent.trim() !== "…";

    if (kpOk) poeNoMenu("menu-kp", kp.textContent.trim(), kp.className);
    if (srOk) poeNoMenu("menu-sr", sr.textContent.trim() + " / 100");

    // Numa página sem painel, ou antes de os dados chegarem, procura sozinho.
    if (kpOk && srOk) return;
    if (menuJaBuscou) return;
    menuJaBuscou = true;

    if (!kpOk) {
      getJSON(SRC.kp).then(function (rows) {
        var linhas = Array.isArray(rows[0])
          ? rows.slice(1).map(function (r) { return { time_tag: r[0], Kp: r[1] }; })
          : rows;
        var r = maisRecente(linhas);
        if (r) poeNoMenu("menu-kp", num(Number(r.Kp)), "");
      }).catch(function () { poeNoMenu("menu-kp", "sem dados", "menu-sem"); });
    }

    if (!srOk) {
      getJSON(SRC.schumann).then(function (d) {
        var f = d && d.fundamental;
        if (f && f.estado === "ok") {
          poeNoMenu("menu-sr", Math.round(f.intensidade) + " / 100");
        } else {
          poeNoMenu("menu-sr", "sem leitura", "menu-sem");
        }
      }).catch(function () { poeNoMenu("menu-sr", "sem dados", "menu-sem"); });
    }
  }

  function wireNav() {
    renderMenu();
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
    if (document.getElementById("gauge-svg")) carregarSchumann();

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
    renderQuakeMap();
    renderVolcanoMap();

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

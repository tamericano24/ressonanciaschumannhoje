/* Bandeiras nacionais desenhadas em SVG, sem imagens nem serviços de fora.
   ============================================================================

   Porque é que isto existe
   ------------------------
   O caminho óbvio era o emoji de bandeira. Não serve: o Windows não traz os
   desenhos das bandeiras na Segoe UI Emoji, e o Chrome e o Edge mostram lá as
   duas letras do código em vez da bandeira. Foi confirmado nesta máquina. Para
   a maior parte de quem visita o site num computador, o emoji não seria
   bandeira nenhuma.

   O caminho seguinte era ir buscar ficheiros de bandeiras a outro sítio.
   Também não: o mapa desta página diz, e é verdade, que é desenhado no
   navegador a partir dos dados, sem imagens de terceiros.

   Sobram os desenhos feitos aqui. Cada bandeira é uma linha de descrição, e a
   função no fim transforma-a em SVG.

   Até onde vai a fidelidade
   -------------------------
   Estas bandeiras aparecem com 20 px de largura numa linha de lista. A essa
   escala o que se lê são as cores, as bandas, o disco, a cruz e o cantão. Um
   brasão ou uma águia ocupam três ou quatro píxeis: desenha-se uma mancha na
   cor certa e no sítio certo, que é o que o olho vê de qualquer maneira.

   O que NÃO se faz é inventar uma bandeira que não se sabe desenhar. Um código
   que não esteja nesta tabela fica com a etiqueta das duas letras, que é
   honesta. Melhor duas letras certas do que um pano colorido errado.

   Formato
   -------
   h    bandas horizontais, de cima para baixo. "cor" ou ["cor", peso]
   v    bandas verticais, da esquerda para a direita
   dg   diagonal: ["cor de cima", "cor de baixo"]
   q    quatro quadrantes: [cima-esq, cima-dir, baixo-esq, baixo-dir]
   n    cruz nórdica (descentrada para o mastro): ["cor"] ou ["cor", "borda"]
   cx   cruz centrada: ["cor", espessura]
   cc   cruz dentro do cantão: [cx, cy, "cor", espessura]
   sal  cruz de Santo André: ["cor", espessura]
   t    triângulo encostado ao mastro: [largura, "cor"]
   t2   segundo triângulo por cima do primeiro
   fx   faixa vertical junto ao mastro: [largura, "cor"]
   fy   faixa horizontal: ["cor", y1, y2]
   c    cantão: [largura, altura, "cor"]
   uj   Union Jack, inteira ou como cantão: [largura, altura]
   d    disco: [cx, cy, r, "cor"]
   rh   losango: ["cor"]
   cr   crescente com estrela: [cx, cy, r, "cor"]
   s    estrelas: [[x, y, raio, "cor"], ...]
   e    emblema, a tal mancha: [cx, cy, r, "cor"]
   ============================================================================ */

(function () {
  "use strict";

  var W = 20, H = 14;

  var F = {
    // ---- Américas ----
    US: { h: ["#b22234", "#fff", "#b22234", "#fff", "#b22234", "#fff", "#b22234"],
          c: [9, 7.5, "#3c3b6e"],
          s: [[2, 1.8, .65, "#fff"], [4.5, 1.8, .65, "#fff"], [7, 1.8, .65, "#fff"],
              [3.2, 3.8, .65, "#fff"], [5.8, 3.8, .65, "#fff"],
              [2, 5.8, .65, "#fff"], [4.5, 5.8, .65, "#fff"], [7, 5.8, .65, "#fff"]] },
    CA: { v: [["#d80621", 1], ["#fff", 2], ["#d80621", 1]], e: [10, 7, 2.4, "#d80621"] },
    MX: { v: ["#006847", "#fff", "#ce1126"], e: [10, 7, 1.9, "#8b5a2b"] },
    GT: { v: ["#4997d0", "#fff", "#4997d0"], e: [10, 7, 1.8, "#5a7d3a"] },
    SV: { h: ["#0f47af", "#fff", "#0f47af"], e: [10, 7, 1.7, "#c8a04a"] },
    // As cinco estrelas do Honduras formam um X, não uma fila.
    HN: { h: ["#0073cf", "#fff", "#0073cf"],
          s: [[10, 7, .75, "#0073cf"], [7.6, 5.6, .6, "#0073cf"], [12.4, 5.6, .6, "#0073cf"],
              [7.6, 8.4, .6, "#0073cf"], [12.4, 8.4, .6, "#0073cf"]] },
    NI: { h: ["#0067c6", "#fff", "#0067c6"], e: [10, 7, 1.7, "#8bb8e0"] },
    CR: { h: [["#002b7f", 1], ["#fff", 1], ["#ce1126", 2], ["#fff", 1], ["#002b7f", 1]] },
    PA: { q: ["#fff", "#da121a", "#072357", "#fff"],
          s: [[5, 3.5, 1.4, "#072357"], [15, 10.5, 1.4, "#da121a"]] },
    CU: { h: ["#002a8f", "#fff", "#002a8f", "#fff", "#002a8f"], t: [8, "#cf142b"],
          s: [[3, 7, 1.5, "#fff"]] },
    JM: { h: ["#009b3a"], sal: ["#fed100", 2.6] },
    HT: { h: ["#00209f", "#d21034"] },
    DO: { q: ["#002d62", "#ce1126", "#ce1126", "#002d62"], cx: ["#fff", 2.6] },
    PR: { h: ["#ed0000", "#fff", "#ed0000", "#fff", "#ed0000"], t: [8, "#0050f0"],
          s: [[3, 7, 1.5, "#fff"]] },
    VI: { h: ["#fff"], e: [10, 7, 2.4, "#0081c8"] },
    CO: { h: [["#fcd116", 2], ["#003893", 1], ["#ce1126", 1]] },
    VE: { h: [["#ffcc00", 1], ["#00247d", 1], ["#cf142b", 1]],
          s: [[7.6, 7.2, .55, "#fff"], [10, 6.6, .55, "#fff"], [12.4, 7.2, .55, "#fff"]] },
    EC: { h: [["#fcd116", 2], ["#003893", 1], ["#ce1126", 1]], e: [10, 7, 1.7, "#7b8fa1"] },
    PE: { v: ["#d91023", "#fff", "#d91023"] },
    BR: { h: ["#009c3b"], rh: ["#ffdf00"], d: [10, 7, 2.1, "#002776"] },
    BO: { h: ["#d52b1e", "#f9e300", "#007934"] },
    CL: { h: ["#fff", "#d52b1e"], c: [8, 7, "#0039a6"], s: [[4, 3.5, 1.7, "#fff"]] },
    AR: { h: ["#74acdf", "#fff", "#74acdf"], e: [10, 7, 1.5, "#f6b40e"] },
    UY: { h: ["#fff", "#0038a8", "#fff", "#0038a8", "#fff", "#0038a8", "#fff", "#0038a8", "#fff"],
          c: [9, 7.8, "#fff"], e: [4.5, 3.9, 1.6, "#f6b40e"] },
    PY: { h: ["#d52b1e", "#fff", "#0038a8"], e: [10, 7, 1.4, "#009b3a"] },
    GY: { h: ["#009e49"], t: [15, "#fcd116"], t2: [8, "#ce1126"] },
    SR: { h: [["#377e3f", 1], ["#fff", .6], ["#b40a2d", 1.8], ["#fff", .6], ["#377e3f", 1]],
          s: [[10, 7, 1.6, "#ecc81d"]] },
    BZ: { h: [["#003f87", 3], ["#ce1126", .7]], d: [10, 6.2, 2.6, "#fff"] },
    GL: { h: ["#fff", "#d00c33"], d: [7, 7, 3.4, "#d00c33"] },

    // ---- Europa e Mediterrâneo ----
    PT: { v: [["#046a38", 2], ["#da291c", 3]], e: [8, 7, 2.2, "#ffe900"] },
    ES: { h: [["#aa151b", 1], ["#f1bf00", 2], ["#aa151b", 1]], e: [6, 7, 1.7, "#ad1519"] },
    FR: { v: ["#002395", "#fff", "#ed2939"] },
    IT: { v: ["#008c45", "#f4f5f0", "#cd212a"] },
    DE: { h: ["#000", "#dd0000", "#ffce00"] },
    GR: { h: ["#0d5eaf", "#fff", "#0d5eaf", "#fff", "#0d5eaf", "#fff", "#0d5eaf", "#fff", "#0d5eaf"],
          c: [7.8, 7.8, "#0d5eaf"], cc: [3.9, 3.9, "#fff", 1.6] },
    TR: { h: ["#e30a17"], cr: [8, 7, 3.2, "#fff"] },
    CY: { h: ["#fff"], e: [10, 6.4, 2, "#d57800"] },
    IS: { h: ["#02529c"], n: ["#dc1e35", "#fff"] },
    NO: { h: ["#ba0c2f"], n: ["#00205b", "#fff"] },
    SE: { h: ["#006aa7"], n: ["#fecc00"] },
    FI: { h: ["#fff"], n: ["#003580"] },
    DK: { h: ["#c8102e"], n: ["#fff"] },
    FO: { h: ["#fff"], n: ["#0065bd", "#ed2939"] },
    GB: { uj: [20, 14] },
    IE: { v: ["#169b62", "#fff", "#ff883e"] },
    RO: { v: ["#002b7f", "#fcd116", "#ce1126"] },
    BG: { h: ["#fff", "#00966e", "#d62612"] },
    AL: { h: ["#e41e20"], e: [10, 7, 2.4, "#000"] },
    HR: { h: ["#ff0000", "#fff", "#171796"], e: [10, 7, 1.8, "#ff0000"] },
    RS: { h: ["#c6363c", "#0c4076", "#fff"], e: [7, 7, 1.8, "#c6363c"] },
    BA: { h: ["#002395"], e: [11, 7, 2.6, "#fecb00"] },
    ME: { h: ["#c40308"], e: [10, 7, 2.4, "#d4af3a"] },
    MK: { h: ["#d20000"], d: [10, 7, 2.6, "#f8e92e"] },
    SI: { h: ["#fff", "#0000c1", "#e03c31"], e: [5.5, 4.5, 1.6, "#0000c1"] },
    AT: { h: ["#ed2939", "#fff", "#ed2939"] },
    CH: { h: ["#d52b1e"], cx: ["#fff", 3] },
    PL: { h: ["#fff", "#dc143c"] },
    UA: { h: ["#005bbb", "#ffd500"] },
    NL: { h: ["#ae1c28", "#fff", "#21468b"] },
    BE: { v: ["#000", "#fdda24", "#ef3340"] },

    // ---- Ásia ----
    RU: { h: ["#fff", "#0039a6", "#d52b1e"] },
    JP: { h: ["#fff"], d: [10, 7, 4.2, "#bc002d"] },
    CN: { h: ["#ee1c25"],
          s: [[4.2, 4.2, 2, "#ffde00"], [7.6, 2.2, .75, "#ffde00"], [8.8, 4, .75, "#ffde00"],
              [8.8, 6.2, .75, "#ffde00"], [7.6, 7.9, .75, "#ffde00"]] },
    TW: { h: ["#fe0000"], c: [10, 7, "#000095"], s: [[5, 3.5, 2.3, "#fff"]] },
    KR: { h: ["#fff"], d: [10, 7, 3, "#cd2e3a"], e: [10, 8.5, 1.5, "#0047a0"] },
    KP: { h: [["#024fa2", 1], ["#fff", .5], ["#ed1c27", 3], ["#fff", .5], ["#024fa2", 1]],
          d: [6, 7, 2.1, "#fff"], s: [[6, 7, 1.5, "#ed1c27"]] },
    PH: { h: ["#0038a8", "#ce1126"], t: [9, "#fff"], s: [[3, 7, 1.5, "#fcd116"]] },
    ID: { h: ["#ce1126", "#fff"] },
    MY: { h: ["#cc0001", "#fff", "#cc0001", "#fff", "#cc0001", "#fff", "#cc0001",
              "#fff", "#cc0001", "#fff", "#cc0001", "#fff", "#cc0001", "#fff"],
          c: [11, 8, "#010066"], cr: [4.2, 4, 2.1, "#ffcc00"] },
    TH: { h: [["#a51931", 1], ["#f4f5f8", 1], ["#2d2a4a", 2], ["#f4f5f8", 1], ["#a51931", 1]] },
    VN: { h: ["#da251d"], s: [[10, 7, 3, "#ffff00"]] },
    MM: { h: ["#fecb00", "#34b233", "#ea2839"], s: [[10, 7, 3, "#fff"]] },
    IN: { h: ["#ff9933", "#fff", "#138808"], d: [10, 7, 1.6, "#000088"] },
    NP: { h: ["#dc143c"], e: [8, 7, 3, "#003893"] },
    BD: { h: ["#006a4d"], d: [9, 7, 3.4, "#f42a41"] },
    LK: { v: [["#ff9800", .8], ["#00534e", .8], ["#ffbe29", .5], ["#8d153a", 3]],
          e: [14, 7, 2.2, "#ffbe29"] },
    PK: { v: [["#fff", 1], ["#01411c", 3]], cr: [12.5, 7, 2.8, "#fff"] },
    AF: { v: ["#000", "#be0000", "#007a36"], e: [10, 7, 2, "#fff"] },
    IR: { h: ["#239f40", "#fff", "#da0000"], e: [10, 7, 1.5, "#da0000"] },
    IQ: { h: ["#ce1126", "#fff", "#000"], e: [10, 7, 1.4, "#007a3d"] },
    GE: { h: ["#fff"], cx: ["#ff0000", 2.6],
          s: [[4, 3.4, .7, "#ff0000"], [16, 3.4, .7, "#ff0000"],
              [4, 10.6, .7, "#ff0000"], [16, 10.6, .7, "#ff0000"]] },
    AM: { h: ["#d90012", "#0033a0", "#f2a800"] },
    AZ: { h: ["#00b5e2", "#ef3340", "#509e2f"], cr: [9.4, 7, 2.1, "#fff"] },
    KZ: { h: ["#00afca"], d: [11, 6, 2.4, "#fec50c"] },
    KG: { h: ["#e8112d"], d: [10, 7, 2.8, "#ffef00"] },
    TJ: { h: [["#cc0000", 1], ["#fff", 1.4], ["#006600", 1]], e: [10, 7, 1.5, "#f8c300"] },
    UZ: { h: [["#0099b5", 1], ["#fff", 1], ["#1eb53a", 1]], cr: [4.6, 3, 1.4, "#fff"] },
    TM: { h: ["#28ae66"], fx: [5, "#c1272d"] },
    MN: { v: ["#c4272f", "#015197", "#c4272f"], e: [3.4, 7, 1.5, "#f9cf02"] },
    TL: { h: ["#dc241f"], t: [14, "#ffc726"], t2: [9, "#000"], s: [[3.2, 7, 1.4, "#fff"]] },
    IL: { h: [["#fff", 1], ["#0038b8", .35], ["#fff", 1.7], ["#0038b8", .35], ["#fff", 1]],
          e: [10, 7, 1.9, "#0038b8"] },
    LB: { h: [["#ee161f", 1], ["#fff", 2], ["#ee161f", 1]], e: [10, 7, 1.8, "#00a850"] },
    SY: { h: ["#009a00", "#fff", "#000"], s: [[8, 7, 1, "#ce1126"], [12, 7, 1, "#ce1126"]] },
    JO: { h: ["#007a3d", "#fff", "#000"], t: [8, "#ce1126"], s: [[3, 7, 1, "#fff"]] },
    SA: { h: ["#165d31"], e: [10, 7, 2.6, "#fff"] },
    AE: { h: ["#00732f", "#fff", "#000"], fx: [5, "#ff0000"] },
    QA: { v: [["#fff", 1], ["#8a1538", 2.5]] },
    OM: { h: ["#fff", "#db161b", "#008000"], fx: [5.5, "#db161b"] },
    YE: { h: ["#ce1126", "#fff", "#000"] },

    // ---- África ----
    MA: { h: ["#c1272d"], s: [[10, 7, 3, "#006233"]] },
    DZ: { v: ["#006233", "#fff"], cr: [9, 7, 2.8, "#d21034"] },
    TN: { h: ["#e70013"], d: [10, 7, 3.6, "#fff"], cr: [9.6, 7, 2.2, "#e70013"] },
    LY: { h: [["#239e46", 1], ["#000", 2], ["#e70013", 1]], cr: [9.4, 7, 1.9, "#fff"] },
    EG: { h: ["#ce1126", "#fff", "#000"], e: [10, 7, 1.5, "#c09300"] },
    ET: { h: ["#078930", "#fcdd09", "#da121a"], d: [10, 7, 3.2, "#0f47af"] },
    ER: { dg: ["#12ad2b", "#0f47af"], t: [14, "#be0027"], e: [4, 7, 1.6, "#f3c300"] },
    DJ: { h: ["#6ab2e7", "#12ad2b"], t: [8, "#fff"], s: [[3, 7, 1.4, "#d7141a"]] },
    SO: { h: ["#4189dd"], s: [[10, 7, 3.2, "#fff"]] },
    SD: { h: ["#d21034", "#fff", "#000"], t: [7, "#007229"] },
    TD: { v: ["#002664", "#fecb00", "#c60c30"] },
    ML: { v: ["#14b53a", "#fcd116", "#ce1126"] },
    NE: { h: [["#e05206", 1], ["#fff", 1], ["#0db02b", 1]], d: [10, 7, 1.9, "#e05206"] },
    NG: { v: ["#008751", "#fff", "#008751"] },
    GH: { h: ["#ce1126", "#fcd116", "#006b3f"], s: [[10, 7, 1.7, "#000"]] },
    GN: { v: ["#ce1126", "#fcd116", "#009460"] },
    CM: { v: ["#007a5e", "#ce1126", "#fcd116"], s: [[10, 7, 1.7, "#fcd116"]] },
    UG: { h: ["#000", "#fcdc04", "#d90000", "#000", "#fcdc04", "#d90000"], d: [10, 7, 2.4, "#fff"] },
    KE: { h: [["#000", 1], ["#fff", .4], ["#bb0000", 1.6], ["#fff", .4], ["#006600", 1]],
          e: [10, 7, 1.8, "#fff"] },
    TZ: { dg: ["#1eb53a", "#00a3dd"], sal: ["#000", 0], tzband: 1 },
    MZ: { h: ["#009543", "#fff", "#000", "#fff", "#ffd100"], t: [7, "#e21c21"],
          s: [[3, 7, 1.4, "#fff"]] },
    MW: { h: ["#000", "#ce1126", "#339e35"], d: [10, 2.8, 1.9, "#ce1126"] },
    ZM: { h: ["#198a00"], e: [16, 4, 1.8, "#de2010"] },
    ZW: { h: ["#006400", "#fce100", "#d40000", "#000", "#d40000", "#fce100", "#006400"],
          t: [7, "#fff"], s: [[2.6, 7, 1.4, "#d40000"]] },
    ZA: { h: [["#e03c31", 1], ["#fff", .4], ["#007749", 1.2], ["#fff", .4], ["#001489", 1]],
          t: [8, "#000"] },
    CV: { h: [["#003893", 3], ["#fff", .7], ["#cf2027", .5], ["#fff", .7], ["#003893", 2]],
          s: [[7, 8.6, 1.5, "#f7d116"]] },

    // ---- Oceânia ----
    AU: { h: ["#00008b"], uj: [10, 7],
          s: [[5, 11, 1.3, "#fff"], [15.5, 4, 1, "#fff"], [17.2, 7.4, 1, "#fff"],
              [14.6, 10, 1, "#fff"], [16.6, 11.6, .75, "#fff"]] },
    NZ: { h: ["#00247d"], uj: [10, 7],
          s: [[16.6, 4, 1, "#cc142b"], [14, 7, 1, "#cc142b"],
              [17.6, 8.6, 1, "#cc142b"], [15.4, 11, 1, "#cc142b"]] },
    PG: { dg: ["#000", "#ce1126"],
          s: [[14, 3.4, .7, "#fff"], [16.2, 5.6, .7, "#fff"],
              [14.4, 7.6, .7, "#fff"], [12.4, 5.6, .7, "#fff"]],
          e: [5.4, 9, 2, "#fcd116"] },
    SB: { dg: ["#0051ba", "#215b33"],
          s: [[2.6, 2.2, .65, "#fff"], [5.4, 2.2, .65, "#fff"], [4, 3.6, .65, "#fff"],
              [2.6, 5, .65, "#fff"], [5.4, 5, .65, "#fff"]] },
    VU: { h: [["#d21034", 1], ["#000", .3], ["#009543", 1]], t: [8, "#000"],
          e: [2.8, 7, 1.3, "#fdce12"] },
    FJ: { h: ["#68bfe5"], uj: [10, 7], e: [15.5, 7.4, 2, "#fff"] },
    TO: { h: ["#c10000"], c: [8.6, 7.2, "#fff"], cc: [4.3, 3.6, "#c10000", 1.5] },
    WS: { h: ["#ce1126"], c: [9, 7.5, "#002b7f"],
          s: [[3, 2.6, .65, "#fff"], [5.6, 3.6, .65, "#fff"], [3.8, 5, .65, "#fff"],
              [6.2, 5.8, .65, "#fff"], [2.4, 4.4, .5, "#fff"]] },
    AS: { h: ["#0071bc"], e: [13, 7, 2, "#bd1021"] },
    NC: { h: ["#0035ad", "#d60000", "#009543"], d: [7, 7, 2.6, "#fbde4a"] },
    PF: { h: [["#ce1126", 1], ["#fff", 1.4], ["#ce1126", 1]], e: [10, 7, 1.8, "#f79c1f"] },
    GU: { h: ["#0071bc"], e: [10, 7, 3, "#be0027"] },
    PW: { h: ["#4aadd6"], d: [8.5, 7, 3.2, "#ffde00"] },
    FM: { h: ["#75b2dd"],
          s: [[10, 4, .9, "#fff"], [10, 10, .9, "#fff"], [7, 7, .9, "#fff"], [13, 7, .9, "#fff"]] },
    MH: { h: ["#00205b"], s: [[4.6, 3.6, 1.6, "#fff"]] },
    KI: { h: [["#ce1126", 1], ["#003f87", 1]], e: [10, 3.6, 2, "#fcd116"] },
    NR: { h: ["#002b7f"], fy: ["#ffc61e", 6.6, 7.4], s: [[5, 10.4, 1.4, "#fff"]] },
    TV: { h: ["#5b97b1"], uj: [10, 7],
          s: [[13, 4, .7, "#fcd116"], [15.4, 6, .7, "#fcd116"],
              [17.4, 8.6, .7, "#fcd116"], [13.6, 10, .7, "#fcd116"]] },
    CK: { h: ["#00247d"], uj: [10, 7],
          s: [[15, 7, .7, "#fff"], [17, 5, .7, "#fff"], [17, 9, .7, "#fff"],
              [13.6, 5, .7, "#fff"], [13.6, 9, .7, "#fff"]] },
    NU: { h: ["#ffcc00"], uj: [10, 7] }
  };

  // --------------------------------------------------------------------
  // Desenho
  // --------------------------------------------------------------------

  var seq = 0;   // para os identificadores internos não se repetirem na página

  function bandas(cores, vertical) {
    var pesos = cores.map(function (c) { return Array.isArray(c) ? c[1] : 1; });
    var total = pesos.reduce(function (a, b) { return a + b; }, 0);
    var tam = vertical ? W : H, pos = 0, s = "";
    cores.forEach(function (c, i) {
      var cor = Array.isArray(c) ? c[0] : c;
      var d = (pesos[i] / total) * tam;
      s += vertical
        ? '<rect x="' + pos.toFixed(2) + '" y="0" width="' + (d + .04).toFixed(2) + '" height="' + H + '" fill="' + cor + '"/>'
        : '<rect x="0" y="' + pos.toFixed(2) + '" width="' + W + '" height="' + (d + .04).toFixed(2) + '" fill="' + cor + '"/>';
      pos += d;
    });
    return s;
  }

  function estrela(x, y, r, cor) {
    var p = "";
    for (var i = 0; i < 5; i++) {
      var a1 = (Math.PI / 180) * (-90 + i * 72);
      var a2 = a1 + (Math.PI / 180) * 36;
      p += (i ? "L" : "M") + (x + Math.cos(a1) * r).toFixed(2) + "," + (y + Math.sin(a1) * r).toFixed(2) +
           "L" + (x + Math.cos(a2) * r * .42).toFixed(2) + "," + (y + Math.sin(a2) * r * .42).toFixed(2);
    }
    return '<path d="' + p + 'Z" fill="' + cor + '"/>';
  }

  // O recorte do crescente é outro círculo na cor do campo, por isso precisa
  // de saber qual é o fundo por baixo dele.
  function crescente(cx, cy, r, cor, fundo) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + cor + '"/>' +
           '<circle cx="' + (cx + r * .36).toFixed(2) + '" cy="' + cy + '" r="' + (r * .82).toFixed(2) +
           '" fill="' + fundo + '"/>' +
           estrela(cx + r * 1.15, cy, r * .52, cor);
  }

  function cruzNordica(cor, borda) {
    // Descentrada para o mastro: é isso que distingue a cruz nórdica.
    var vx = 6.4, vw = 3, hy = 5.5, hh = 3, s = "";
    if (borda) {
      s += '<rect x="' + (vx - .9) + '" y="0" width="' + (vw + 1.8) + '" height="' + H + '" fill="' + borda + '"/>' +
           '<rect x="0" y="' + (hy - .9) + '" width="' + W + '" height="' + (hh + 1.8) + '" fill="' + borda + '"/>';
    }
    return s + '<rect x="' + vx + '" y="0" width="' + vw + '" height="' + H + '" fill="' + cor + '"/>' +
               '<rect x="0" y="' + hy + '" width="' + W + '" height="' + hh + '" fill="' + cor + '"/>';
  }

  function unionJack(w, h, id) {
    var e = w / 20, f = h / 14;   // a mesma figura serve de bandeira e de cantão
    function r(x, y, ww, hh, c) {
      return '<rect x="' + (x * e).toFixed(2) + '" y="' + (y * f).toFixed(2) +
             '" width="' + (ww * e).toFixed(2) + '" height="' + (hh * f).toFixed(2) + '" fill="' + c + '"/>';
    }
    var d = "M0,0 L" + (20 * e).toFixed(2) + "," + (14 * f).toFixed(2) +
            " M" + (20 * e).toFixed(2) + ",0 L0," + (14 * f).toFixed(2);
    return '<defs><clipPath id="' + id + '"><rect width="' + (20 * e).toFixed(2) +
           '" height="' + (14 * f).toFixed(2) + '"/></clipPath></defs>' +
      r(0, 0, 20, 14, "#012169") +
      '<g clip-path="url(#' + id + ')">' +
        '<path d="' + d + '" stroke="#fff" stroke-width="' + (3 * f).toFixed(2) + '"/>' +
        '<path d="' + d + '" stroke="#c8102e" stroke-width="' + (1.3 * f).toFixed(2) + '"/></g>' +
      r(7.5, 0, 5, 14, "#fff") + r(0, 4.2, 20, 5.6, "#fff") +
      r(8.6, 0, 2.8, 14, "#c8102e") + r(0, 5.3, 20, 3.4, "#c8102e");
  }

  function desenha(iso, id) {
    var f = F[iso];
    if (!f) return "";
    var s = "", fundo = "#fff";

    if (f.h) { s += bandas(f.h, false); fundo = Array.isArray(f.h[0]) ? f.h[0][0] : f.h[0]; }
    if (f.v) { s += bandas(f.v, true); fundo = Array.isArray(f.v[0]) ? f.v[0][0] : f.v[0]; }
    if (f.q) {
      s += '<rect width="10" height="7" fill="' + f.q[0] + '"/><rect x="10" width="10" height="7" fill="' + f.q[1] + '"/>' +
           '<rect y="7" width="10" height="7" fill="' + f.q[2] + '"/><rect x="10" y="7" width="10" height="7" fill="' + f.q[3] + '"/>';
      fundo = f.q[0];
    }
    if (f.dg) {
      s += '<rect width="' + W + '" height="' + H + '" fill="' + f.dg[0] + '"/>' +
           '<path d="M0,' + H + " L" + W + ",0 L" + W + "," + H + 'Z" fill="' + f.dg[1] + '"/>';
      fundo = f.dg[0];
    }
    if (f.tzband) s += '<path d="M0,14 L20,0" stroke="#000" stroke-width="3.4"/>' +
                       '<path d="M0,14 L20,0" stroke="#fcd116" stroke-width="4.6" stroke-opacity="0"/>';
    if (f.uj && !f.h) s += unionJack(f.uj[0], f.uj[1], id);
    if (f.n) s += cruzNordica(f.n[0], f.n[1]);
    if (f.sal && f.sal[1]) s += '<path d="M0,0 L20,14 M20,0 L0,14" stroke="' + f.sal[0] +
                                '" stroke-width="' + f.sal[1] + '"/>';
    if (f.cx) s += '<rect x="' + ((W - f.cx[1]) / 2) + '" y="0" width="' + f.cx[1] + '" height="' + H +
                   '" fill="' + f.cx[0] + '"/><rect x="0" y="' + ((H - f.cx[1]) / 2) + '" width="' + W +
                   '" height="' + f.cx[1] + '" fill="' + f.cx[0] + '"/>';
    if (f.t) s += '<path d="M0,0 L' + f.t[0] + ',7 L0,14Z" fill="' + f.t[1] + '"/>';
    if (f.t2) s += '<path d="M0,0 L' + f.t2[0] + ',7 L0,14Z" fill="' + f.t2[1] + '"/>';
    if (f.fx) s += '<rect x="0" y="0" width="' + f.fx[0] + '" height="' + H + '" fill="' + f.fx[1] + '"/>';
    if (f.fy) s += '<rect x="0" y="' + f.fy[1] + '" width="' + W + '" height="' + (f.fy[2] - f.fy[1]) +
                   '" fill="' + f.fy[0] + '"/>';
    if (f.c) s += '<rect x="0" y="0" width="' + f.c[0] + '" height="' + f.c[1] + '" fill="' + f.c[2] + '"/>';
    if (f.uj && f.h) s += unionJack(f.uj[0], f.uj[1], id);
    if (f.cc) s += '<rect x="' + (f.cc[0] - f.cc[3] / 2) + '" y="0" width="' + f.cc[3] + '" height="' +
                   (f.cc[1] * 2) + '" fill="' + f.cc[2] + '"/><rect x="0" y="' + (f.cc[1] - f.cc[3] / 2) +
                   '" width="' + (f.cc[0] * 2) + '" height="' + f.cc[3] + '" fill="' + f.cc[2] + '"/>';
    if (f.rh) s += '<path d="M10,1 L19,7 L10,13 L1,7Z" fill="' + f.rh[0] + '"/>';
    if (f.d) s += '<circle cx="' + f.d[0] + '" cy="' + f.d[1] + '" r="' + f.d[2] + '" fill="' + f.d[3] + '"/>';
    if (f.cr) s += crescente(f.cr[0], f.cr[1], f.cr[2], f.cr[3], fundo);
    if (f.s) f.s.forEach(function (a) { s += estrela(a[0], a[1], a[2], a[3]); });
    if (f.e && f.e[2]) s += '<circle cx="' + f.e[0] + '" cy="' + f.e[1] + '" r="' + f.e[2] +
                            '" fill="' + f.e[3] + '" fill-opacity=".92"/>';
    return s;
  }

  // Devolve o SVG pronto a colar, ou "" se não soubermos desenhar este país.
  window.BANDEIRA_SVG = function (iso) {
    var id = "uj" + (++seq);
    var corpo = desenha(iso, id);
    if (!corpo) return "";
    return '<svg class="bandeira" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">' + corpo + "</svg>";
  };
})();

#!/usr/bin/env python3
"""
Gerador da leitura diaria.

Corre uma vez por dia, le os dados publicos da NOAA e do USGS, e escreve uma
pagina HTML nova em leitura/AAAA-MM-DD.html. Atualiza tambem o indice do
arquivo, as ligacoes anterior/seguinte e o sitemap.

Nao inventa dados: tudo o que aparece no texto vem dos numeros lidos nesse
momento. Quando uma fonte falha, a frase correspondente desaparece em vez de
ser preenchida com um valor plausivel.

Uso:
    python gerar-leitura.py                 # gera a leitura de hoje
    python gerar-leitura.py 2026-08-04      # gera a de uma data especifica
"""

import json
import sys
import re
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

RAIZ = Path(__file__).parent
PASTA = RAIZ / "leitura"
DOMINIO = "https://ressonanciaschumannhoje.com"

FONTES = {
    "kp":       "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    "xray":     "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json",
    "flares":   "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json",
    "vento":    "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",
    "mag":      "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",
    "protoes":  "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json",
    "escalas":  "https://services.swpc.noaa.gov/products/noaa-scales.json",
    "previsao": "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
    "sismos":   "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
    "vulcoes":  "https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes&status=open&limit=100",
    # A nossa propria medicao, lida do espectrograma pelo ler-schumann.py.
    "schumann": ("https://raw.githubusercontent.com/tamericano24/"
                 "ressonanciaschumannhoje/dados/schumann.json"),
}

NOMES_HARM = {14.3: "2.ª harmónica", 20.8: "3.ª harmónica",
              27.3: "4.ª harmónica", 33.8: "5.ª harmónica"}

MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho",
         "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
            "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
DIAS_PT = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira",
           "sexta-feira", "sábado", "domingo"]


# ----------------------------------------------------------------------
# Recolha
# ----------------------------------------------------------------------

def buscar(url, timeout=45):
    req = urllib.request.Request(url, headers={"User-Agent": "ressonancia-schumann-hoje/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def tenta(chave):
    try:
        return buscar(FONTES[chave])
    except Exception as e:
        print(f"  aviso: {chave} indisponivel ({e})")
        return None


def ler_utc(s):
    if not s:
        return None
    t = str(s).strip().replace(" ", "T").rstrip("Z")
    try:
        return datetime.fromisoformat(t).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def nvl(v, casas=1):
    """Numero com virgula decimal, como se escreve em portugues."""
    return f"{v:.{casas}f}".replace(".", ",")


# ----------------------------------------------------------------------
# Versao de cache (?v=N)
#
# O numero vive num sitio so: o index.html. Antes estava tambem escrito a mao
# aqui dentro, e isso criava duas verdades: quando o CSS mudava depois de o
# robo ja ter gerado a leitura do dia, essa leitura ficava a apontar para a
# folha de estilo antiga e servia um aspeto diferente do resto do site.
# ----------------------------------------------------------------------

RE_VERSAO = re.compile(r"(css/style\.css|js/app\.js|js/world-path\.js)\?v=\d+")


def versao_ativa():
    """Le o ?v=N do index.html, que e a referencia para o site inteiro."""
    try:
        txt = (RAIZ / "index.html").read_text(encoding="utf-8-sig")
        m = re.search(r"css/style\.css\?v=(\d+)", txt)
        if m:
            return m.group(1)
    except OSError:
        pass
    return "1"


VERSAO = versao_ativa()


def normalizar_versoes():
    """
    Alinha as leituras ja escritas com a versao ativa.

    Corre a cada execucao, portanto qualquer desalinhamento fica resolvido no
    dia seguinte sem ninguem se lembrar de o fazer a mao.
    """
    alterados = []
    for p in sorted(PASTA.glob("*.html")):
        bruto = p.read_bytes()
        # Preservar o BOM se existir: reescrever sem ele mudava todos os
        # ficheiros a cada execucao, enchendo o historico de ruido invisivel.
        bom = bruto.startswith(b"\xef\xbb\xbf")
        txt = bruto.decode("utf-8-sig")
        novo = RE_VERSAO.sub(rf"\1?v={VERSAO}", txt)
        if novo != txt:
            saida = novo.encode("utf-8")
            p.write_bytes(b"\xef\xbb\xbf" + saida if bom else saida)
            alterados.append(p.name)
    return alterados


# ----------------------------------------------------------------------
# Interpretacao
# ----------------------------------------------------------------------

def info_kp(kp):
    if kp < 2:  return ("muito calmo", "is-calm", None)
    if kp < 3:  return ("calmo", "is-calm", None)
    if kp < 4:  return ("instavel", "is-mild", None)
    if kp < 5:  return ("ativo", "is-active", None)
    if kp < 6:  return ("tempestade G1", "is-active", "G1")
    if kp < 7:  return ("tempestade G2", "is-storm", "G2")
    if kp < 8:  return ("tempestade G3", "is-storm", "G3")
    if kp < 9:  return ("tempestade G4", "is-severe", "G4")
    return ("tempestade G5", "is-severe", "G5")


def classe_raiox(fluxo):
    if not fluxo or fluxo <= 0:
        return None
    for limite, letra in ((1e-4, "X"), (1e-5, "M"), (1e-6, "C"), (1e-7, "B")):
        if fluxo >= limite:
            return f"{letra}{nvl(fluxo / limite)}"
    return f"A{nvl(fluxo / 1e-8)}"


def indice_energia(kp, nivel_raiox, n_sismos, mag_max):
    """Mesma formula do painel. Ver metodologia.html."""
    geo = min(kp / 9, 1) * 60
    solar = (nivel_raiox / 4) * 25 if nivel_raiox is not None else 0
    seis = 0
    if n_sismos is not None:
        por_conta = min(n_sismos / 25, 1)
        por_mag = min(max((mag_max or 0) - 4.5, 0) / 3, 1)
        seis = (por_conta * 0.5 + por_mag * 0.5) * 15
    return max(0, min(100, round(geo + solar + seis)))


def banda(score):
    if score < 20:  return ("Calmo", "is-calm")
    if score < 40:  return ("Suave", "is-mild")
    if score < 60:  return ("Agitado", "is-active")
    if score < 80:  return ("Turbulento", "is-storm")
    return ("Extremo", "is-severe")


TITULOS = {
    "Calmo": ["Campo tranquilo, dia sem sobressaltos",
              "Silencio geomagnetico sobre o planeta",
              "Um dos dias mais calmos do mes"],
    "Suave": ["Ligeira agitacao, nada de relevante",
              "Campo estavel com pequenas oscilacoes",
              "Fundo tranquilo, com ondulacao ao de leve"],
    "Agitado": ["Campo geomagnetico em movimento",
                "Agitacao moderada no escudo magnetico",
                "Dia inquieto, sem chegar a tempestade"],
    "Turbulento": ["Tempestade geomagnetica em curso",
                   "O escudo magnetico sob pressao",
                   "Campo perturbado, auroras em latitudes medias"],
    "Extremo": ["Condicoes extremas, alertas ativos",
                "Tempestade severa sobre o planeta",
                "Evento raro no campo geomagnetico"],
}

# Acentuacao correta dos titulos, fora do dicionario acima para o ficheiro
# continuar legivel em qualquer terminal.
ACENTOS = {
    "Campo tranquilo, dia sem sobressaltos": "Campo tranquilo, dia sem sobressaltos",
    "Silencio geomagnetico sobre o planeta": "Silêncio geomagnético sobre o planeta",
    "Um dos dias mais calmos do mes": "Um dos dias mais calmos do mês",
    "Ligeira agitacao, nada de relevante": "Ligeira agitação, nada de relevante",
    "Campo estavel com pequenas oscilacoes": "Campo estável com pequenas oscilações",
    "Fundo tranquilo, com ondulacao ao de leve": "Fundo tranquilo, com ondulação ao de leve",
    "Campo geomagnetico em movimento": "Campo geomagnético em movimento",
    "Agitacao moderada no escudo magnetico": "Agitação moderada no escudo magnético",
    "Dia inquieto, sem chegar a tempestade": "Dia inquieto, sem chegar a tempestade",
    "Tempestade geomagnetica em curso": "Tempestade geomagnética em curso",
    "O escudo magnetico sob pressao": "O escudo magnético sob pressão",
    "Campo perturbado, auroras em latitudes medias": "Campo perturbado, auroras em latitudes médias",
    "Condicoes extremas, alertas ativos": "Condições extremas, alertas ativos",
    "Tempestade severa sobre o planeta": "Tempestade severa sobre o planeta",
    "Evento raro no campo geomagnetico": "Evento raro no campo geomagnético",
}


def escolher_titulo(palavra, data):
    """Deterministico: a mesma data da sempre o mesmo titulo."""
    opcoes = TITULOS[palavra]
    return ACENTOS[opcoes[data.toordinal() % len(opcoes)]]


# ----------------------------------------------------------------------
# Texto
# ----------------------------------------------------------------------

def escrever_corpo(d):
    """Constroi o texto a partir dos numeros. Cada frase so aparece se o dado
    existir.

    Devolve uma lista de blocos (titulo_h2, paragrafo). O titulo pode ser None
    na abertura, que vem logo a seguir ao h1 e nao precisa de cabecalho. Os
    restantes levam h2: sem eles a pagina era uma parede de paragrafos sem
    estrutura nenhuma, o que nao ajuda quem le nem quem indexa.
    """
    p = []

    # 1. abertura com o estado geral
    ab = [f"<b>{d['data'].day} de {MESES_PT[d['data'].month - 1]} de {d['data'].year}.</b> "
          f"O campo geomagnético da Terra está em estado <b>{d['kp_label']}</b>, "
          f"com um índice Kp de {nvl(d['kp'])}."]
    if d["kp_escala"]:
        ab.append(f" Isto coloca o dia na escala de tempestade {d['kp_escala']} da NOAA.")
    else:
        ab.append(" Fica abaixo do limiar de tempestade, que começa em Kp 5.")
    if d["energia"] is not None:
        ab.append(f" O índice de energia composto deste site marca {d['energia']} em 100, "
                  f"o que corresponde a um dia {d['banda'].lower()}.")
    p.append((None, "".join(ab)))

    # 2. Sol
    sol = []
    if d["raiox"]:
        sol.append(f"O fluxo de raios-X do Sol está em {d['raiox']}.")
        if d["raiox"][0] in "AB":
            sol.append(" É um valor de fundo, típico de um Sol sossegado.")
        elif d["raiox"][0] == "C":
            sol.append(" É atividade moderada, comum em períodos de Sol ativo.")
        else:
            sol.append(" É atividade forte, do tipo que perturba comunicações de rádio.")
    if d["flare"]:
        sol.append(f" A última erupção registada foi de classe {d['flare']}"
                   + (f", há {d['flare_horas']} horas." if d["flare_horas"] is not None else "."))
    if d["vento_vel"]:
        sol.append(f" O vento solar sopra a {nvl(d['vento_vel'], 0)} quilómetros por segundo")
        if d["vento_vel"] >= 600:
            sol.append(", uma velocidade alta que costuma vir de um buraco coronal.")
        elif d["vento_vel"] >= 450:
            sol.append(", acima da média.")
        else:
            sol.append(", dentro do normal.")
    if sol:
        p.append(("O que o Sol está a fazer", "".join(sol)))

    # 3. Bz, o dado que antecipa tempestades
    if d["bz"] is not None:
        titulo_bz = "O aviso prévio: a componente Bz"
        if d["bz"] <= -10:
            p.append((titulo_bz,
                      f"A componente Bz do campo magnético interplanetário está em "
                      f"{nvl(d['bz'])} nT, fortemente virada a sul. É a configuração que permite "
                      f"ao vento solar acoplar-se ao campo da Terra e injetar energia. Se se "
                      f"mantiver, o Kp tende a subir nas horas seguintes."))
        elif d["bz"] < 0:
            p.append((titulo_bz,
                      f"A componente Bz está em {nvl(d['bz'])} nT, ligeiramente a sul. "
                      f"Há algum acoplamento com o campo terrestre, mas fraco."))
        else:
            p.append((titulo_bz,
                      f"A componente Bz está em {nvl(d['bz'])} nT, virada a norte. Nesta "
                      f"orientação o vento solar passa ao lado sem transferir energia "
                      f"significativa: é a porta fechada."))

    # 4. o que significa na prática
    pratico = []
    if d["kp"] >= 7:
        pratico.append("Na prática: possíveis erros de GPS, perturbações em rádio de alta "
                       "frequência e correntes induzidas em redes elétricas. Auroras possíveis "
                       "bem abaixo das latitudes habituais.")
    elif d["kp"] >= 5:
        pratico.append("Na prática: pequenas flutuações em redes elétricas e rádio HF perturbado "
                       "em latitudes altas. Auroras visíveis a partir do norte da Europa.")
    elif d["kp"] >= 4:
        pratico.append("Na prática: sem impacto tecnológico esperado. Auroras possíveis na "
                       "Escandinávia e na Islândia.")
    else:
        pratico.append("Na prática: sem impacto tecnológico. As auroras ficam confinadas às "
                       "regiões polares.")
    if d["prev_kp"]:
        pratico.append(f" A previsão da NOAA aponta um Kp máximo de {nvl(d['prev_kp'])} para as "
                       f"próximas 24 horas.")
    p.append(("O que isto significa na prática", "".join(pratico)))

    # 5. Terra
    terra = []
    if d["sismos"] is not None:
        terra.append(f"Na superfície, o USGS registou {d['sismos']} sismos de magnitude 4,5 ou "
                     f"superior nas últimas 24 horas")
        terra.append(f", o maior de magnitude {nvl(d['mag_max'])}." if d["mag_max"] else ".")
    if d["vulcoes"]:
        terra.append(f" A NASA contabiliza {d['vulcoes']} vulcões atualmente em erupção no mundo.")
    if terra:
        terra.append(" Estes números aparecem como contexto do dia, não como consequência da "
                     "atividade solar: não existe ligação demonstrada entre as duas coisas.")
        p.append(("O que a Terra registou", "".join(terra)))

    # 6. a Ressonancia de Schumann propriamente dita, medida nesta manha.
    #    E o unico numero desta pagina que e nosso, lido do espectrograma pelo
    #    ler-schumann.py, e por isso e o que torna cada leitura diferente das
    #    outras em vez de mais uma variacao dos mesmos indices da NOAA.
    if d.get("sr_hz"):
        sr = [f"No espectrograma da estação de Tomsk, o pico da fundamental estava em "
              f"<b>{nvl(d['sr_hz'], 2)} Hz</b>, com uma intensidade de {d['sr_int']} em 100 "
              f"na escala de cor da imagem"]
        sr.append(f", na medição das {d['sr_hora']} UTC." if d.get("sr_hora") else ".")
        if d.get("sr_harm"):
            sr.append(" " + d["sr_harm"])
        sr.append(" A frequência de referência é 7,83 Hz, e a variação de décimas ao longo do dia "
                  "é normal: acompanha a altura da ionosfera, que sobe de noite e desce de dia. "
                  "A intensidade não está calibrada em picotesla, porque a estação não publica a "
                  "calibração.")
        p.append(("A Ressonância de Schumann medida hoje", "".join(sr)))

    # 7. o que observar
    if d["kp"] >= 5:
        p.append(("O que observar hoje",
                  "Se estiver no norte da Europa e o céu estiver "
                  "limpo, vale a pena olhar para norte depois do anoitecer. Confirme também se há "
                  "alertas ativos da NOAA antes de contar com GPS para trabalho de precisão."))
    elif d["kp"] >= 4:
        p.append(("O que observar hoje",
                  "O campo está agitado sem chegar a tempestade. É um "
                  "bom dia para acompanhar o Bz, porque é ele que decide se a agitação passa a "
                  "tempestade nas próximas horas."))
    else:
        p.append(("O que observar hoje",
                  "Dias calmos como este são os mais úteis para "
                  "estabelecer uma linha de base. Se está a registar como se sente ao longo do "
                  "tempo, é hoje que fica a saber como é um dia normal."))

    return p


# ----------------------------------------------------------------------
# HTML
# ----------------------------------------------------------------------

CABECA = """<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo} · {data_curta}</title>
<meta name="description" content="{descricao}">
<!-- Sem .html de proposito: a Cloudflare responde a /leitura/{iso}.html com um
     307 para /leitura/{iso}. Um canonico que redireciona gasta rastreio a toa. -->
<link rel="canonical" href="{dominio}/leitura/{iso}">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../css/style.css?v={versao}">
<script type="application/ld+json">
{jsonld}
</script>
</head>
<body>

<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="../index.html"><svg class="brand-icone" viewBox="0 0 28 24" aria-hidden="true"><path d="M1 12h5l2.6-8.5L13 20l3.4-11 2.2 3H27" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="brand-nome">Ressonância Schumann Hoje</span></a>
      <button class="nav-toggle" type="button" aria-label="Abrir menu do site"><span class="barras"><i></i><i></i><i></i></span>Menu</button>
  </div>
</header>

<main class="wrap">
<article class="article">
  <p class="meta"><a href="../index.html">Painel</a> / <a href="index.html">Leituras diárias</a></p>

  <div class="insight-top">
    <span>{dia_semana}</span><span>·</span><span>{data_longa}</span>
    <span class="state {cls}">{banda}</span>
  </div>

  <h1>{titulo}</h1>
  <p class="tagline" style="text-align:left;margin:0 0 22px;max-width:none">{resumo}</p>

  <div class="metric-row" style="margin-bottom:26px">
    <div class="metric"><b class="{cls}">{energia}</b><span>Energia da Terra</span></div>
    <div class="metric"><b>{kp}</b><span>Índice Kp</span></div>
    <div class="metric"><b>{raiox}</b><span>Raios-X</span></div>
    <div class="metric"><b>{vento}</b><span>Vento solar</span></div>
  </div>

{corpo}

  <div class="card support" style="margin:30px 0">
    <h3>Esta leitura é gerada todos os dias</h3>
    <p class="sub" style="color:var(--text-dim)">Sem publicidade e sem rastreadores. Se lhe é útil, ajude a manter o projeto.</p>
    <div class="btn-row">
      <a class="btn" href="../apoiar.html">Apoiar o projeto</a>
      <a class="btn ghost" href="../index.html">Ver o painel ao vivo</a>
    </div>
  </div>

  <nav class="leitura-nav">
{anterior}
{seguinte}
  </nav>

  <p style="margin-top:24px"><a href="index.html">← Todas as leituras diárias</a></p>
</article>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-bottom">
      <span>© <span data-year></span> Ressonância de Schumann Hoje</span>
      <span><a href="../privacidade.html">Privacidade</a> · <a href="../termos.html">Termos</a> · <a href="../metodologia.html">Metodologia</a></span>
    </div>
  </div>
</footer>

<script src="../js/app.js?v={versao}"></script>
</body>
</html>
"""


def gerar_html(d, anterior, seguinte):
    iso = d["data"].strftime("%Y-%m-%d")
    data_longa = f"{d['data'].day} de {MESES_PT[d['data'].month - 1]} de {d['data'].year}"
    data_curta = f"{d['data'].day}/{d['data'].month:02d}/{d['data'].year}"
    dia_semana = DIAS_PT[d["data"].weekday()]

    corpo = "\n".join(
        (f"  <h2>{t}</h2>\n  <p>{par}</p>" if t else f"  <p>{par}</p>")
        for t, par in escrever_corpo(d)
    )
    resumo = (
        f"Kp {nvl(d['kp'])} ({d['kp_label']})"
        + (f", raios-X {d['raiox']}" if d["raiox"] else "")
        + (f", vento solar a {nvl(d['vento_vel'], 0)} km/s" if d["vento_vel"] else "")
        + f". Índice de energia {d['energia']} em 100."
    )

    # A description do Google, diferente do resumo mostrado na pagina: aquele e
    # uma lista de numeros e sozinho dava 85 caracteres, metade do que cabe num
    # resultado de pesquisa. Esta leva a data e a Schumann do dia, que e o que
    # distingue esta leitura de todas as outras.
    #
    # Monta-se por pedacos, do mais importante para o menos, e so entra o
    # pedaco que ainda couber: assim nunca sai uma frase cortada a meio.
    descricao = f"Clima espacial de {data_longa}: Kp {nvl(d['kp'])} ({d['kp_label']})"
    for pedaco in [
        f", raios-X {d['raiox']}" if d["raiox"] else "",
        (f". Ressonância de Schumann medida em {nvl(d['sr_hz'], 2)} Hz"
         if d.get("sr_hz") else
         f", vento solar a {nvl(d['vento_vel'], 0)} km/s" if d["vento_vel"] else ""),
        f". Índice de energia {d['energia']} em 100" if d["energia"] is not None else "",
    ]:
        if pedaco and len(descricao) + len(pedaco) + 1 <= 158:
            descricao += pedaco
    descricao += "."

    jsonld = json.dumps({
        "@context": "https://schema.org",
        "@graph": [{
            "@type": "Article",
            "headline": f"{d['titulo']} · {data_curta}",
            "datePublished": iso,
            "dateModified": iso,
            "inLanguage": "pt",
            "description": descricao,
            "mainEntityOfPage": f"{DOMINIO}/leitura/{iso}",
            "isPartOf": {"@type": "WebSite", "@id": f"{DOMINIO}/#site"},
            "about": {"@type": "Thing", "name": "Ressonância de Schumann"},
            "author": {"@type": "Organization", "name": "Ressonância de Schumann Hoje",
                       "url": f"{DOMINIO}/sobre"},
            "publisher": {"@type": "Organization", "name": "Ressonância de Schumann Hoje",
                          "url": DOMINIO},
        }, {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Painel", "item": DOMINIO + "/"},
                {"@type": "ListItem", "position": 2, "name": "Leituras diárias",
                 "item": f"{DOMINIO}/leitura/"},
                {"@type": "ListItem", "position": 3, "name": data_longa,
                 "item": f"{DOMINIO}/leitura/{iso}"},
            ],
        }],
    }, ensure_ascii=False, indent=1)

    return CABECA.format(
        titulo=d["titulo"], iso=iso, dominio=DOMINIO, versao=VERSAO,
        data_curta=data_curta, data_longa=data_longa, dia_semana=dia_semana,
        descricao=descricao.replace('"', "'"), jsonld=jsonld,
        cls=d["cls"], banda=d["banda"], resumo=resumo,
        energia=d["energia"], kp=nvl(d["kp"]),
        raiox=d["raiox"] or "n/d",
        vento=(nvl(d["vento_vel"], 0) + " km/s") if d["vento_vel"] else "n/d",
        corpo=corpo,
        anterior=bloco_nav(anterior, "ant"), seguinte=bloco_nav(seguinte, "seg"),
    )


# ----------------------------------------------------------------------
# Recolha e montagem
# ----------------------------------------------------------------------

def recolher(data):
    print("A recolher dados...")
    d = {"data": data, "kp": None, "raiox": None, "flare": None, "flare_horas": None,
         "vento_vel": None, "bz": None, "sismos": None, "mag_max": None,
         "vulcoes": None, "prev_kp": None}

    kp = tenta("kp")
    if kp:
        linhas = [r for r in kp if isinstance(r, dict) and r.get("Kp") is not None] if isinstance(kp[0], dict) \
                 else [{"Kp": float(r[1])} for r in kp[1:] if r[1] not in (None, "")]
        if linhas:
            d["kp"] = float(linhas[-1]["Kp"])
    if d["kp"] is None:
        raise SystemExit("Sem indice Kp: nao ha leitura possivel. Tente mais tarde.")

    d["kp_label"], d["cls_kp"], d["kp_escala"] = info_kp(d["kp"])

    nivel_raiox = None
    xr = tenta("xray")
    if xr:
        longos = [r for r in xr if r.get("energy") == "0.1-0.8nm"]
        if longos:
            fluxo = longos[-1]["flux"]
            d["raiox"] = classe_raiox(fluxo)
            nivel_raiox = {"A": 0, "B": 1, "C": 2, "M": 3, "X": 4}.get(d["raiox"][0], 0)

    fl = tenta("flares")
    if fl:
        ult = fl[-1]
        d["flare"] = (ult.get("max_class") or "").replace(".", ",") or None
        t = ler_utc(ult.get("max_time") or ult.get("begin_time"))
        if t:
            d["flare_horas"] = round((datetime.now(timezone.utc) - t).total_seconds() / 3600)

    ve = tenta("vento")
    if ve:
        bons = [r for r in ve if (r.get("proton_speed") or 0) > 0]
        if bons:
            d["vento_vel"] = max(bons, key=lambda r: r["time_tag"])["proton_speed"]

    mg = tenta("mag")
    if mg:
        bons = [r for r in mg if r.get("bz_gsm") is not None]
        if bons:
            d["bz"] = max(bons, key=lambda r: r["time_tag"])["bz_gsm"]

    sq = tenta("sismos")
    if sq:
        feats = sq.get("features", [])
        d["sismos"] = len(feats)
        mags = [f["properties"]["mag"] for f in feats if f["properties"].get("mag")]
        d["mag_max"] = max(mags) if mags else None

    vu = tenta("vulcoes")
    if vu:
        d["vulcoes"] = len(vu.get("events", []))

    pv = tenta("previsao")
    if pv:
        agora = datetime.now(timezone.utc)
        futuros = []
        for r in pv:
            t = ler_utc(r.get("time_tag") if isinstance(r, dict) else r[0])
            v = r.get("kp") if isinstance(r, dict) else r[1]
            obs = str(r.get("observed", "") if isinstance(r, dict) else (r[2] if len(r) > 2 else ""))
            if t and v is not None and "pred" in obs.lower():
                if 0 <= (t - agora).total_seconds() <= 86400:
                    futuros.append(float(v))
        if futuros:
            d["prev_kp"] = max(futuros)

    # A medicao da Schumann desta manha. Nao se aceita uma leitura recusada
    # nem uma leitura velha: se o recetor de Tomsk estava saturado, a seccao
    # simplesmente nao aparece na pagina, como acontece com as outras fontes.
    sr = tenta("schumann")
    if sr and (sr.get("fundamental") or {}).get("estado") == "ok" and sr.get("estado") == "ok":
        f = sr["fundamental"]
        d["sr_hz"] = f.get("pico_hz")
        d["sr_int"] = round(f.get("intensidade", 0))
        t = ler_utc(sr.get("atualizado"))
        d["sr_hora"] = t.strftime("%H:%M") if t else None
        hs = [h for h in (sr.get("harmonicas") or []) if h.get("estado") == "ok"]
        if hs:
            d["sr_harm"] = "Nessa mesma coluna, " + ", ".join(
                "a {} aparecia em {} Hz ({})".format(
                    NOMES_HARM.get(h["nominal_hz"], h.get("modo", "harmónica")),
                    nvl(h["pico_hz"], 2), round(h["intensidade"]))
                for h in hs) + "."

    d["energia"] = indice_energia(d["kp"], nivel_raiox, d["sismos"], d["mag_max"])
    d["banda"], d["cls"] = banda(d["energia"])
    d["titulo"] = escolher_titulo(d["banda"], data)
    return d


def carregar_existentes():
    """Le as leituras ja geradas, para montar as ligacoes anterior/seguinte."""
    PASTA.mkdir(exist_ok=True)
    itens = []
    for f in sorted(PASTA.glob("*.html")):
        if f.name == "index.html":
            continue
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})\.html$", f.name)
        if not m:
            continue
        html = f.read_text(encoding="utf-8")
        t = re.search(r"<h1>(.*?)</h1>", html, re.S)
        data = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        itens.append({
            "iso": f.stem,
            "data": data,
            "data_longa": f"{data.day} de {MESES_PT[data.month - 1]} de {data.year}",
            "titulo": (t.group(1).strip() if t else f.stem),
        })
    return sorted(itens, key=lambda x: x["iso"])


def bloco_nav(item, sentido):
    if not item:
        return ""
    seta = "←" if sentido == "ant" else "→"
    rot = "Leitura anterior" if sentido == "ant" else "Leitura seguinte"
    alinha = "" if sentido == "ant" else ' style="text-align:right"'
    return (f'    <a class="leitura-link"{alinha} href="{item["iso"]}.html">'
            f'<span class="k">{seta} {rot}</span>'
            f'<b>{item["titulo"]}</b>'
            f'<span class="d">{item["data_longa"]}</span></a>')


def reescrever_navegacao(itens):
    """Repoe o bloco anterior/seguinte em todas as leituras ja escritas."""
    for i, it in enumerate(itens):
        p = PASTA / f'{it["iso"]}.html'
        html = p.read_text(encoding="utf-8")
        if '<nav class="leitura-nav">' not in html:
            continue
        ant = itens[i - 1] if i > 0 else None
        seg = itens[i + 1] if i < len(itens) - 1 else None
        novo = ('<nav class="leitura-nav">\n'
                + bloco_nav(ant, "ant") + "\n"
                + bloco_nav(seg, "seg") + "\n  </nav>")
        html = re.sub(r'<nav class="leitura-nav">.*?</nav>', novo, html, flags=re.S)
        p.write_text(html, encoding="utf-8")


def escrever_indice(itens):
    linhas = []
    for it in reversed(itens):
        linhas.append(
            f'      <a class="card post-card" href="{it["iso"]}.html">'
            f'<div class="kicker">{it["data_longa"]}</div>'
            f'<h3>{it["titulo"]}</h3></a>'
        )
    html = f"""<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Leituras diárias da Ressonância de Schumann</title>
<meta name="description" content="Arquivo das leituras diárias: a Ressonância de Schumann medida, o campo geomagnético, o Sol e o vento solar, dia a dia e em português.">
<link rel="canonical" href="{DOMINIO}/leitura/">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../css/style.css?v={VERSAO}">
</head>
<body>

<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="../index.html"><svg class="brand-icone" viewBox="0 0 28 24" aria-hidden="true"><path d="M1 12h5l2.6-8.5L13 20l3.4-11 2.2 3H27" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="brand-nome">Ressonância Schumann Hoje</span></a>
  </div>
</header>

<main class="wrap">
  <div class="hero">
    <h1><span class="l1">Leituras diárias</span></h1>
    <p class="tagline">Uma página por dia, com o estado do campo geomagnético, do Sol e do vento solar. Gerada a partir dos dados, não da imaginação.</p>
  </div>

  <div class="post-grid" style="margin-bottom:40px">
{chr(10).join(linhas)}
  </div>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-bottom">
      <span>© <span data-year></span> Ressonância de Schumann Hoje</span>
      <span><a href="../privacidade.html">Privacidade</a> · <a href="../termos.html">Termos</a> · <a href="../metodologia.html">Metodologia</a></span>
    </div>
  </div>
</footer>

<script src="../js/app.js?v={VERSAO}"></script>
</body>
</html>
"""
    (PASTA / "index.html").write_text(html, encoding="utf-8")


def escrever_sitemap(itens):
    # Enderecos sem .html: e o que a Cloudflare devolve com 200. Com .html
    # devolve 307, e um sitemap cheio de redirecionamentos e um sitemap que o
    # Google tem de percorrer duas vezes para chegar a cada pagina.
    estaticas = [
        ("/", "hourly", "1.0"),
        ("/indice-kp-agora", "hourly", "0.9"),
        ("/aurora-esta-noite", "hourly", "0.9"),
        ("/leitura/", "daily", "0.8"),
        ("/arquivo", "daily", "0.7"),
        ("/incorporar", "monthly", "0.7"),
        ("/sintomas", "monthly", "0.8"),
        ("/faq", "monthly", "0.8"),
        ("/metodologia", "monthly", "0.6"),
        ("/sobre", "yearly", "0.4"),
        ("/apoiar", "yearly", "0.4"),
        ("/blog/", "weekly", "0.7"),
        ("/blog/o-que-e-a-ressonancia-de-schumann", "monthly", "0.9"),
        ("/blog/7-83-hz-frequencia-da-terra", "monthly", "0.9"),
        ("/blog/tempestades-geomagneticas-e-o-corpo", "monthly", "0.9"),
        ("/blog/erupcoes-solares-classes-c-m-x", "monthly", "0.9"),
    ]
    linhas = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<!-- Gerado por gerar-leitura.py. Nao editar a mao. -->',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    # O <lastmod> e o unico dos tres campos a que o Google diz dar atencao, e
    # so quando e verdade. As paginas ao vivo mudam mesmo todos os dias: o
    # prerender.py reescreve o index.html e as outras leem dados novos.
    hoje = datetime.now(timezone.utc).date().isoformat()
    vivas = {"/", "/indice-kp-agora", "/aurora-esta-noite", "/leitura/", "/arquivo"}
    for caminho, freq, pri in estaticas:
        lastmod = f"<lastmod>{hoje}</lastmod>" if caminho in vivas else ""
        linhas.append(f"  <url><loc>{DOMINIO}{caminho}</loc>{lastmod}"
                      f"<changefreq>{freq}</changefreq><priority>{pri}</priority></url>")
    for it in reversed(itens):
        linhas.append(f'  <url><loc>{DOMINIO}/leitura/{it["iso"]}</loc>'
                      f"<lastmod>{it['iso']}</lastmod>"
                      f"<changefreq>monthly</changefreq><priority>0.6</priority></url>")
    linhas.append("</urlset>")
    (RAIZ / "sitemap.xml").write_text("\n".join(linhas) + "\n", encoding="utf-8")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    forcar = "--forcar" in sys.argv

    data = datetime.now(timezone.utc)
    if args:
        data = datetime.strptime(args[0], "%Y-%m-%d")
        hoje = datetime.now(timezone.utc).date()
        if data.date() != hoje and not forcar:
            # As APIs so devolvem o estado atual. Gerar uma data passada
            # escreveria os numeros de hoje sob a data de ontem, o que e
            # inventar um registo. So se faz com intencao explicita.
            raise SystemExit(
                f"Recusado: {args[0]} nao e hoje ({hoje}).\n"
                "As fontes so dao o estado atual, por isso a pagina ficaria com os\n"
                "numeros de hoje sob outra data. Use --forcar apenas para testes."
            )

    d = recolher(data)
    iso = data.strftime("%Y-%m-%d")
    print(f"\n{iso}: {d['titulo']}")
    print(f"  Kp {nvl(d['kp'])} · energia {d['energia']}/100 · {d['banda']}")

    PASTA.mkdir(exist_ok=True)
    # ficheiro provisorio, para entrar na lista e calcular vizinhos
    (PASTA / f"{iso}.html").write_text(f"<h1>{d['titulo']}</h1>", encoding="utf-8")

    itens = carregar_existentes()
    pos = next(i for i, x in enumerate(itens) if x["iso"] == iso)
    anterior = itens[pos - 1] if pos > 0 else None
    seguinte = itens[pos + 1] if pos < len(itens) - 1 else None

    (PASTA / f"{iso}.html").write_text(gerar_html(d, anterior, seguinte), encoding="utf-8")

    # Reconstroi a navegacao de todas as leituras. Assim a cadeia fica sempre
    # coerente, mesmo que os ficheiros tenham sido gerados fora de ordem.
    itens = carregar_existentes()
    reescrever_navegacao(itens)

    escrever_indice(itens)
    escrever_sitemap(itens)

    # Rede de seguranca: se alguma leitura antiga tiver ficado com uma versao
    # de cache desalinhada, corrige-se aqui, sem depender de ninguem se lembrar.
    corrigidas = normalizar_versoes()
    if corrigidas:
        print(f"Versao  : {len(corrigidas)} leitura(s) alinhadas em v={VERSAO} "
              f"({', '.join(corrigidas[:4])}{'...' if len(corrigidas) > 4 else ''})")

    print(f"\nEscrito : leitura/{iso}.html")
    print(f"Arquivo : leitura/index.html ({len(itens)} leituras)")
    print(f"Sitemap : sitemap.xml ({len(itens) + 15} URLs)")


if __name__ == "__main__":
    main()










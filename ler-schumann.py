#!/usr/bin/env python3
"""
Leitura da Ressonancia de Schumann a partir do espectrograma de Tomsk.

Corre de 30 em 30 minutos na GitHub Action e escreve schumann.json, que o
painel le. Ver .github/workflows/schumann.yml

Metodo: a imagem publicada por Tomsk e um espectrograma com o eixo vertical
em frequencia (0 a 40 Hz) e a barra de cores ao lado a servir de escala.
Vai-se a coluna de tempo mais recente com dados, procura-se o pico dentro da
banda de cada modo e converte-se a cor em intensidade pela propria barra.

Nao inventa nada. Quando a banda esta saturada, sem dados, ou quando a leitura
nao e de confianca, devolve o motivo e nenhum valor. Ver metodologia.html

Uso:
    python ler-schumann.py                # le o feed e escreve schumann.json
    python ler-schumann.py imagem.jpg     # le um ficheiro local, so mostra
"""

import io
import json
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from PIL import Image

FEED = "https://sos70.ru/provider.php?file=shm.jpg"
SAIDA = Path(__file__).parent / "schumann.json"

# Geometria da imagem publicada por Tomsk. Se algum destes valores deixar de
# bater certo, a leitura para em vez de devolver numeros errados.
LARGURA, ALTURA = 1540, 460
TOPO, BASE, ESQ = 29, 430, 59          # 0 Hz, 40 Hz, hora 0 do primeiro dia
LARG_DIA, DIAS, HZ_MAX = 480, 3, 40.0
SPAN_HORAS = DIAS * 24          # a imagem cobre exatamente tres dias
BARRA_X = (1512, 1527)

# Bandas onde procurar cada pico, largas o suficiente para o pico se mover.
MODOS = [
    ("fundamental", 7.83, 6.6, 9.2),
    ("2a harmonica", 14.3, 12.8, 15.8),
    ("3a harmonica", 20.8, 19.3, 22.3),
]

TOPO_DA_ESCALA = 95.0   # acima disto e saturacao a sangrar, nao leitura


def descarregar(url=FEED, timeout=45):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def y_de_hz(hz):
    return TOPO + (hz / HZ_MAX) * (BASE - TOPO)


def escala_de_cores(a):
    """A barra lateral, de cima (maximo) para baixo (minimo)."""
    faixa = a[:, BARRA_X[0]:BARRA_X[1]].mean(1)
    viva = ((faixa.max(1) - faixa.min(1)) > 40) | (faixa.min(1) > 235)
    corridas, ini, prev = [], None, None
    for y in range(100, BASE + 5):
        if viva[y]:
            if ini is None:
                ini = y
            elif y != prev + 1:
                corridas.append((ini, prev))
                ini = y
            prev = y
    if ini is not None:
        corridas.append((ini, prev))
    if not corridas:
        return None
    y0, y1 = max(corridas, key=lambda c: c[1] - c[0])
    if y1 - y0 < 150:                   # barra curta demais: o formato mudou
        return None
    return faixa[y0:y1 + 1]


def colunas_para_tras(a):
    """
    As colunas da imagem por ordem inversa de tempo, da mais recente para a
    mais antiga, atravessando os tres paineis diarios.

    E isto que permite ter sempre um valor para mostrar: quando a hora atual
    esta saturada, recua-se na propria imagem ate a ultima medicao valida. O
    valor mostrado e sempre real, so tem idade.
    """
    for dia in range(DIAS - 1, -1, -1):
        x_ini = ESQ + dia * LARG_DIA
        for x in range(x_ini + LARG_DIA - 1, x_ini - 1, -1):
            if (a[TOPO + 2:BASE - 1, x].sum(1) > 60).mean() > 0.5:
                yield x, dia


def coluna_recente(a):
    """Ultima coluna com dados, e o inicio do painel a que pertence."""
    for x, dia in colunas_para_tras(a):
        return x, ESQ + dia * LARG_DIA
    return None, ESQ + (DIAS - 1) * LARG_DIA


def estado_da_banda(a, x, y_a, y_b):
    faixa = a[y_a:y_b + 1, max(ESQ, x - 2):x + 1].reshape(-1, 3)
    if (faixa.sum(1) < 60).mean() > 0.5:
        return "sem_dados"
    if (faixa.min(1) > 240).mean() > 0.5:
        return "saturado"
    return "ok"


def intensidades(a, escala, x, y_a, y_b):
    """Cada linha da banda convertida em 0-100 pela barra de cores."""
    bloco = a[y_a:y_b + 1, max(ESQ, x - 2):x + 1]
    fora = []
    for i in range(bloco.shape[0]):
        d = ((bloco[i][:, None, :] - escala[None, :, :]) ** 2).sum(2)
        idx, dist = d.argmin(1), np.sqrt(d.min(1))
        ok = dist < 70
        fora.append(np.median(100 * (1 - idx[ok] / (len(escala) - 1))) if ok.sum() else np.nan)
    return np.array(fora, dtype=float)


def ler_modo(a, escala, x, nome, nominal, hz_a, hz_b):
    y_a, y_b = int(round(y_de_hz(hz_a))), int(round(y_de_hz(hz_b)))
    est = estado_da_banda(a, x, y_a, y_b)
    if est != "ok":
        return {"modo": nome, "nominal_hz": nominal, "estado": est}

    vals = intensidades(a, escala, x, y_a, y_b)
    if np.all(np.isnan(vals)):
        return {"modo": nome, "nominal_hz": nominal, "estado": "sem_correspondencia"}

    i = int(np.nanargmax(vals))
    pico = float(vals[i])

    # Um pico encostado ao limite da banda quase sempre e o rebordo de uma zona
    # saturada ao lado, nao a ressonancia. O mesmo para valores no topo da
    # escala de cor. Nos dois casos vale mais nao dar numero.
    if i <= 0 or i >= len(vals) - 1:
        return {"modo": nome, "nominal_hz": nominal, "estado": "pico_no_limite"}
    if pico >= TOPO_DA_ESCALA:
        return {"modo": nome, "nominal_hz": nominal, "estado": "saturado"}

    hz = hz_a + (i / (len(vals) - 1)) * (hz_b - hz_a)
    return {"modo": nome, "nominal_hz": nominal, "estado": "ok",
            "pico_hz": round(hz, 2),
            "intensidade": round(pico, 1),
            "fundo": round(float(np.nanmedian(vals)), 1)}


def ler(dados):
    agora = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    base = {"atualizado": agora, "fonte": FEED,
            "escala": "intensidade 0-100 na escala de cor do espectrograma, nao calibrada em picotesla"}

    im = Image.open(io.BytesIO(dados)).convert("RGB")
    if im.size != (LARGURA, ALTURA):
        return dict(base, estado="formato_desconhecido",
                    detalhe=f"esperava {LARGURA}x{ALTURA}, veio {im.size[0]}x{im.size[1]}")

    a = np.asarray(im).astype(int)
    escala = escala_de_cores(a)
    if escala is None:
        return dict(base, estado="formato_desconhecido", detalhe="barra de cores nao encontrada")

    def instante(x, dia):
        """Horas desde o inicio do primeiro painel, para calcular idades."""
        return dia * 24 + (x - (ESQ + dia * LARG_DIA)) / (LARG_DIA / 24)

    colunas = list(colunas_para_tras(a))
    if not colunas:
        return dict(base, estado="sem_dados", detalhe="a imagem nao tem dados")

    x_novo, dia_novo = colunas[0]
    t_novo = instante(x_novo, dia_novo)
    motivo_atual = ler_modo(a, escala, x_novo, *MODOS[0])["estado"]

    # Ate onde a estacao ja escreveu, dentro da janela de 72 horas da imagem.
    #
    # O painel mostrava isto lendo os pixeis da imagem no navegador. Como a
    # estacao nao envia cabecalhos CORS, essa leitura tinha de passar por um
    # intermediario de imagens, o que custava 204 kB e uma dependencia de
    # terceiros a cada visita. Aqui a imagem ja esta aberta: calcula-se e
    # publica-se, e o navegador deixa de precisar do intermediario.
    base = dict(base, janela_horas=SPAN_HORAS,
                horas_registadas=round(min(max(t_novo, 0.0), SPAN_HORAS), 2))

    # Recua na imagem, de 15 em 15 minutos, ate encontrar uma medicao valida.
    # O valor mostrado e sempre uma medicao real; quando nao e da hora atual,
    # diz-se ha quanto tempo foi feita.
    for x, dia in colunas[::5]:
        fund = ler_modo(a, escala, x, *MODOS[0])
        if fund["estado"] != "ok":
            continue
        atraso = round(t_novo - instante(x, dia), 2)
        harm = [ler_modo(a, escala, x, *m) for m in MODOS[1:]]
        return dict(base,
                    estado="ok" if atraso <= 0.5 else "ultima_conhecida",
                    hora_local_tomsk=round((x - (ESQ + dia * LARG_DIA)) / (LARG_DIA / 24), 2),
                    atraso_horas=atraso,
                    motivo_do_atraso=None if atraso <= 0.5 else motivo_atual,
                    fundamental=fund,
                    harmonicas=harm)

    return dict(base, estado="sem_leitura_em_72h", detalhe=motivo_atual,
                fundamental={"estado": motivo_atual}, harmonicas=[])


# ----------------------------------------------------------------------
# Historico
#
# Ate agora cada leitura substituia a anterior e a medicao antiga
# desaparecia: 48 medicoes por dia deitadas fora. Passa a haver um segundo
# ficheiro que so cresce, ao lado do schumann.json.
#
# A branch continua a ser reescrita a cada execucao, portanto o repositorio
# continua com um unico commit e nao incha. O que muda e que o ficheiro do
# historico e descarregado antes, a linha nova e acrescentada ao fim, e o
# conjunto volta a subir.
#
# Formato em listas e nao em objetos, para nao repetir os nomes dos campos
# 1440 vezes: assim trinta dias cabem em cerca de 60 kB.
# ----------------------------------------------------------------------

HISTORICO = Path(__file__).resolve().parent / "historico.json"
DIAS_HISTORICO = 30
CAMPOS = ["t", "hz", "intensidade", "estado"]


def carregar_historico():
    try:
        d = json.loads(HISTORICO.read_text(encoding="utf-8"))
        return d.get("dados", []) if isinstance(d, dict) else []
    except (OSError, ValueError):
        return []


def atualizar_historico(leitura):
    """Junta esta leitura ao historico e corta o que passou dos 30 dias."""
    linhas = carregar_historico()
    f = leitura.get("fundamental") or {}

    # Guarda-se sempre uma linha, mesmo quando a leitura foi recusada: saber
    # que a estacao esteve saturada das 3h as 5h e informacao, nao e ruido.
    linhas.append([
        leitura.get("atualizado"),
        round(f["pico_hz"], 2) if f.get("estado") == "ok" else None,
        round(f["intensidade"], 1) if f.get("estado") == "ok" else None,
        f.get("estado") or leitura.get("estado") or "desconhecido",
    ])

    # Ordena e remove repetidos pelo instante, para o caso de a mesma execucao
    # correr duas vezes.
    vistos, limpo = set(), []
    for linha in sorted(linhas, key=lambda x: x[0] or ""):
        if linha[0] and linha[0] not in vistos:
            vistos.add(linha[0])
            limpo.append(linha)

    corte = (datetime.now(timezone.utc) - timedelta(days=DIAS_HISTORICO)).isoformat()
    limpo = [linha for linha in limpo if linha[0] >= corte]

    HISTORICO.write_text(json.dumps(
        {"campos": CAMPOS, "dias": DIAS_HISTORICO,
         "escala": "intensidade 0-100 na escala de cor do espectrograma, nao calibrada",
         "dados": limpo}, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8")
    return len(limpo)


def main():
    if len(sys.argv) > 1:
        print(json.dumps(ler(open(sys.argv[1], "rb").read()), ensure_ascii=False, indent=2))
        return
    try:
        r = ler(descarregar())
    except Exception as e:
        r = {"atualizado": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
             "estado": "fonte_indisponivel", "detalhe": str(e)[:200]}
    SAIDA.write_text(json.dumps(r, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("historico: {} leituras guardadas".format(atualizar_historico(r)))
    print(json.dumps(r, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

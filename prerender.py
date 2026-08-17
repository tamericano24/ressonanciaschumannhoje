#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Escreve os valores da Ressonancia de Schumann dentro do index.html.

Porque e que isto existe
------------------------
Todos os numeros do painel sao pedidos pelo navegador depois de a pagina
carregar. Para quem visita, nao ha diferenca: um segundo depois esta tudo la.
Para o Google, ha: o que fica no indice e muitas vezes o HTML tal como sai do
servidor, e nesse HTML o medidor dizia "a carregar" e os mosaicos diziam "...".

O concorrente que aparece em primeiro lugar mostra "F1 7.65 Hz, amplitude 3.3,
fator Q 6.8" e uma data de atualizacao dentro do proprio HTML. E por isso que o
resultado dele traz numeros e uma data, e o nosso nao trazia nada.

Este script le o mesmo schumann.json que o painel le, e escreve os valores nos
sitios certos do index.html. O JavaScript continua a mandar: mal os dados ao
vivo chegam, substitui o que aqui foi escrito. O que fica no ficheiro e uma
fotografia datada da ultima medicao, com a data a vista.

Honestidade
-----------
Vale aqui a mesma regra do resto do projeto: nunca se inventa um numero. Se o
JSON diz que nao ha leitura de confianca, e isso que fica escrito no HTML. E o
texto diz sempre de quando e a medicao.

Uso
---
    python prerender.py            # le o JSON publicado na branch dados
    python prerender.py --ficheiro schumann.json

Corre no fim do leitura-diaria.yml, a seguir ao gerar-leitura.py.
"""

import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
INDEX = RAIZ / "index.html"

FONTE = ("https://raw.githubusercontent.com/tamericano24/"
         "ressonanciaschumannhoje/dados/schumann.json")

# O Cloudflare devolve 403 ao User-Agent do Python. O raw.githubusercontent nao,
# mas mandamos um de navegador na mesma para nao depender disso.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

MOTIVOS = {
    "saturado":             "recetor saturado em Tomsk",
    "sem_dados":            "ainda sem dados desta hora",
    "pico_no_limite":       "leitura sem confianca",
    "sem_correspondencia":  "leitura sem confianca",
    "formato_desconhecido": "a fonte mudou de formato",
    "fonte_indisponivel":   "fonte indisponivel",
}

DESDE = {
    "saturado":            "saturada",
    "sem_dados":           "sem dados novos",
    "pico_no_limite":      "sem leitura de confianca",
    "sem_correspondencia": "sem leitura de confianca",
}

NOMES = {14.3: "2.ª harmónica", 20.8: "3.ª harmónica",
         27.3: "4.ª harmónica", 33.8: "5.ª harmónica"}

MODOS_NOMINAIS = ("Os modos nominais da cavidade Terra-ionosfera são "
                  "7,83, 14,3, 20,8, 27,3 e 33,8 Hz.")


# ----------------------------------------------------------------------
# Leitura do JSON
# ----------------------------------------------------------------------

def carregar(caminho=None):
    if caminho:
        return json.loads(Path(caminho).read_text(encoding="utf-8"))
    ped = urllib.request.Request(FONTE, headers={"User-Agent": UA})
    with urllib.request.urlopen(ped, timeout=45) as r:
        return json.loads(r.read().decode("utf-8"))


# ----------------------------------------------------------------------
# Formatacao, a condizer com o que o js/app.js escreve
# ----------------------------------------------------------------------

def hz(v):
    """Uma casa decimal, a condizer com hzPico() do js/app.js.

    A banda da fundamental ocupa 27 linhas de pixeis no espectrograma, o que
    da 0,10 Hz por linha: centesimas nao existem na imagem, e a segunda casa
    saia sempre zero. Ao mexer aqui, mexer la.
    """
    return "{:.1f}".format(v).replace(".", ",") + " Hz"


def idade(horas):
    m = int(round(horas * 60))
    if m < 60:
        return "há {} min".format(m)
    h, r = divmod(m, 60)
    return "há {} h".format(h) + (" {}".format(r) if r else "")


def velha(d):
    return d.get("estado") == "ultima_conhecida" and (d.get("atraso_horas") or 0) > 0.5


MESES = ("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro")


def carimbo(d):
    """"10 de agosto às 17:40 UTC", a partir do campo "atualizado" do JSON.

    Tudo o que este script escreve no ficheiro leva esta data colada. E a
    diferenca entre uma fotografia datada e um numero velho a fazer-se passar
    por atual: o ficheiro pode ficar 24 horas no ar ate a proxima publicacao, e
    se o JavaScript nao correr e este texto que o visitante le.
    """
    try:
        t = datetime.fromisoformat((d or {}).get("atualizado", ""))
    except ValueError:
        return None
    t = t.astimezone(timezone.utc)
    return "{} de {} às {:02d}:{:02d} UTC".format(t.day, MESES[t.month - 1],
                                                  t.hour, t.minute)


def frase_modos(d):
    """A frase dos modos, na versao datada.

    A funcao fraseModos() do js/app.js constroi a mesma frase, tambem no
    passado e tambem com a hora a vista. Escrevia-a no presente ("o pico esta
    em"), na ideia de que no navegador os dados sao do momento: nao sao, vem
    deste mesmo ficheiro, que o robo reescreve cerca de uma vez por hora e
    meia. Ao mexer numa, mexer na outra.
    """
    f = (d or {}).get("fundamental") or {}
    quando = carimbo(d)
    if not d or f.get("estado") != "ok":
        motivo = MOTIVOS.get((d or {}).get("estado"), "fonte indisponível")
        return ("Sem leitura de confiança na última verificação"
                + (", a {}".format(quando) if quando else "") + ": " + motivo
                + ". " + MODOS_NOMINAIS)

    t = ("Na medição de " + (quando or "referência") + ", o pico da fundamental estava em <b>"
         + hz(f["pico_hz"]) + "</b>, com intensidade " + str(round(f["intensidade"]))
         + " em 100 na escala de cor do espectrograma.")

    hs = [h for h in (d.get("harmonicas") or []) if h.get("estado") == "ok"]
    if hs:
        t += " " + ", ".join(
            "{} em {} ({})".format(NOMES.get(h["nominal_hz"], h["modo"]),
                                   hz(h["pico_hz"]), round(h["intensidade"]))
            for h in hs) + "."
    return t + " " + MODOS_NOMINAIS


def legenda(d):
    f = (d or {}).get("fundamental") or {}
    quando = carimbo(d)
    if not d or f.get("estado") != "ok":
        return "Pico da fundamental · " + MOTIVOS.get(
            (d or {}).get("estado"), "fonte indisponível")
    if velha(d):
        return ("Pico da fundamental · última medição de confiança, Tomsk "
                + DESDE.get(d.get("motivo_do_atraso"), "sem dados novos")
                + " desde então")
    return "Pico da fundamental · medição de " + (quando or "Tomsk")


# ----------------------------------------------------------------------
# Escrita no HTML
# ----------------------------------------------------------------------

def troca(html, padrao, novo, etiqueta, falhas):
    """Substitui uma ocorrencia e queixa-se se nao encontrar nenhuma.

    Uma marcacao que deixe de existir no index.html tem de dar erro visivel,
    senao o script passa a nao fazer nada e ninguem repara durante meses.
    """
    novo_html, n = re.subn(padrao, novo, html, count=1, flags=re.S)
    if n == 0:
        falhas.append(etiqueta)
    return novo_html


def escrever(d):
    html = INDEX.read_text(encoding="utf-8")
    original = html
    falhas = []
    f = (d or {}).get("fundamental") or {}
    ok = bool(d) and f.get("estado") == "ok"

    valor = str(round(f["intensidade"])) if ok else "?"
    pico = hz(f["pico_hz"]) if ok else "sem leitura"
    # Sem "há X min" aqui: este texto pode ficar 24 horas no ficheiro, e uma
    # idade escrita a duro envelhece mal. O js/app.js poe a idade real assim
    # que os dados ao vivo chegam.
    rodape = ("Última medição de confiança · Tomsk" if ok and velha(d) else
              ("Pico da fundamental · Tomsk" if ok else
               MOTIVOS.get((d or {}).get("estado"), "fonte indisponível")))

    # O medidor grande.
    html = troca(html, r'(<div class="gauge-value" id="idx-value">).*?(</div>)',
                 lambda m: m.group(1) + valor + m.group(2), "idx-value", falhas)
    html = troca(html, r'(<div class="gauge-unit" id="idx-word">).*?(</div>)',
                 lambda m: m.group(1) + pico + m.group(2), "idx-word", falhas)
    html = troca(html, r'(<p class="gauge-legenda" id="sr-legenda">).*?(</p>)',
                 lambda m: m.group(1) + legenda(d) + m.group(2), "sr-legenda", falhas)

    # O mosaico da Schumann.
    html = troca(html, r'(<span id="t-sr">).*?(</span>)',
                 lambda m: m.group(1) + valor + m.group(2), "t-sr", falhas)
    html = troca(html, r'(<div class="tile-sub" id="t-sr-sub">).*?(</div>)',
                 lambda m: m.group(1) + pico + m.group(2), "t-sr-sub", falhas)
    html = troca(html, r'(<div class="tile-foot" id="t-sr-foot">).*?(</div>)',
                 lambda m: m.group(1) + rodape + m.group(2), "t-sr-foot", falhas)

    # A frase dos modos, por baixo do espectrograma.
    html = troca(html, r'(<!--PR:modos-->).*?(<!--/PR:modos-->)',
                 lambda m: m.group(1) + frase_modos(d) + m.group(2), "PR:modos", falhas)

    # A data nos dados estruturados. E daqui que sai a data que o Google mostra
    # ao lado do resultado. Usa-se a hora da medicao, nao a hora de agora: dizer
    # que a pagina mudou quando a medicao e a mesma seria falso.
    quando = d.get("atualizado") if d else None
    if not quando:
        quando = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    html = re.sub(r'("dateModified"\s*:\s*")[^"]*(")',
                  lambda m: m.group(1) + quando + m.group(2), html)

    if falhas:
        print("ERRO: marcacoes nao encontradas no index.html: "
              + ", ".join(falhas), file=sys.stderr)
        print("      O index.html mudou de forma. Corrigir os padroes do "
              "prerender.py antes de publicar.", file=sys.stderr)
        return 1

    if html == original:
        print("index.html: sem alteracoes, os valores ja eram estes.")
        return 0

    INDEX.write_text(html, encoding="utf-8")
    print("index.html: {} · {} · {}".format(valor, pico, quando))
    return 0


def main():
    ap = argparse.ArgumentParser(description="Injeta a medicao da Schumann no index.html")
    ap.add_argument("--ficheiro", help="ler de um JSON local em vez da branch dados")
    args = ap.parse_args()

    try:
        d = carregar(args.ficheiro)
    except Exception as e:                                    # noqa: BLE001
        # Sem dados nao se toca no ficheiro. Deixar o que la esta, que e uma
        # medicao real datada, e melhor do que apagar tudo para pos "?".
        print("Sem acesso ao schumann.json ({}). index.html fica como esta.".format(e),
              file=sys.stderr)
        return 0

    return escrever(d)


if __name__ == "__main__":
    raise SystemExit(main())

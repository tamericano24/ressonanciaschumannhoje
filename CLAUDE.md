# Contexto do projeto

Ficheiro lido automaticamente no início de cada sessão. Contém o que não se
deduz olhando para o código.

## O que é

**Ressonância de Schumann Hoje** (https://ressonanciaschumannhoje.com), painel
ao vivo do clima espacial em português. Concorrente direto:
`schumannresonance.today`, que tem mais páginas mas dados menos fiáveis.

Site estático puro. **Sem framework, sem build, sem npm.** HTML + CSS + um
ficheiro JavaScript. Não sugerir React, Vite ou bundlers.

## Publicação

GitHub → Cloudflare Workers (ficheiros estáticos), automático a cada `push`.

```bash
git add . ; git commit -m "descricao" ; git push
```

- Repositório: `github.com/tamericano24/ressonanciaschumannhoje`
- Config do Worker: [wrangler.jsonc](wrangler.jsonc), sem comando de build
- [.assetsignore](.assetsignore) impede que `.py`, `.bat` e o README sejam servidos
- A publicação demora 1 a 3 minutos. Verificar sempre antes de dizer que está feito.

**Ao mudar CSS ou JS, incrementar `?v=N` em todos os ficheiros**, senão os
visitantes ficam com a versão antiga em cache.

O número vive num sítio só: o `index.html`. O [gerar-leitura.py](gerar-leitura.py)
lê-o de lá (`versao_ativa()`) em vez de o ter escrito à mão, e no fim de cada
execução alinha todas as leituras já escritas (`normalizar_versoes()`). Isto
resolve a corrida que existia antes: o robô gerava a leitura das 06:20 com a
versão da altura, e se o CSS mudasse depois essa página ficava a servir a folha
de estilo antiga. Agora corrige-se sozinha no dia seguinte.

```powershell
Get-ChildItem -Recurse -Include *.html,*.py -File | Where-Object { $_.FullName -notmatch '\\\.git\\' } | ForEach-Object {
  $c = Get-Content $_.FullName -Raw -Encoding UTF8
  $n = $c -replace '(css/style\.css|js/app\.js|js/world-path\.js)\?v=\d+','$1?v=NOVO'
  if ($n -ne $c) { Set-Content $_.FullName $n -Encoding UTF8 }
}
```

## Onde se configuram as coisas

Tudo em [js/app.js](js/app.js), no topo das respetivas secções:

| Bloco | Para quê |
|---|---|
| `SRC` | endereços de todas as APIs |
| `APOIO` | links do Stripe e PayPal, meta mensal, apoiantes |
| `MENU` | painel de navegação, injetado em todas as páginas |
| `PULSO_API` | vazio; preencher para o pulso de sintomas ficar comunitário |
| `SINTOMAS` | lista de sintomas do bloco "Como se sente hoje" |

Acrescentar uma página ao site: criar o HTML e juntar uma linha ao `MENU`.

## Preferências do utilizador, já manifestadas

- **Nada de travessões** (o traço longo, U+2014). Foi pedido explicitamente e
  limpou-se o site todo. Traços curtos em intervalos (0–40 Hz) são aceitáveis.
- **Nada de caixas de aviso médico.** Foram todas removidas por decisão dele.
- **Não falar de custos** na página de apoio. Falar do que o apoio permite.
- Respostas diretas, sem repetir explicações já dadas.
- Prefere que se faça e se verifique, em vez de se pedir confirmação a cada passo.

## Limite que se mantém

Foi pedido um contador falso de "pessoas online" (variar entre 20 e 40) e foi
recusado, com insistência do utilizador. Números inventados apresentados aos
visitantes como reais não se escrevem. O mesmo se aplica a votos, apoiantes ou
valores angariados. A alternativa oferecida foi um contador verdadeiro via
Durable Objects, que ele não aceitou. Não voltar a levantar o assunto sem ser
perguntado; se voltar a ser pedido, a resposta é a mesma.

## Armadilhas conhecidas

**Estação de Tomsk.** O endereço `sosrff.tsu.ru/new/shm.jpg` está congelado
desde 1 de setembro de 2025 e continua online. Muitos sites publicam-no como se
fosse atual, incluindo o concorrente. O feed vivo é
`sos70.ru/provider.php?file=shm.jpg`. Isto é a nossa principal vantagem
competitiva e está explicado em [metodologia.html](metodologia.html).

**Fuso do espectrograma.** O eixo do gráfico está em hora local de Tomsk
(UTC+7), não em UTC. Confirmado por haver dados às 20h quando em UTC eram 16h.
O site não converte fusos de propósito: mostra "X h registadas, Y h por
registar", que é verdadeiro em qualquer fuso.

**Feeds da NOAA em ordem inconsistente.** Uns vêm do mais recente para o mais
antigo, outros ao contrário. Usar a função `maisRecente()`, nunca `rows[rows.length-1]`.

**Cloudflare bloqueia o User-Agent do Python.** Para testar o site publicado a
partir de scripts, enviar um User-Agent de navegador, senão devolve 403.

## Estado atual

Funciona sozinho: painel ao vivo, e-mail `geral@ressonanciaschumannhoje.com`,
donativos Stripe ligados, e uma leitura nova gerada todos os dias às 06:20 UTC
pela GitHub Action em [.github/workflows/leitura-diaria.yml](.github/workflows/leitura-diaria.yml).

**Por fazer, por ordem de retorno:**

1. **Artigos.** Temos 3, o concorrente tem 89. É a maior lacuna. Palavras-chave
   sugeridas na secção 7 do [README.md](README.md).
2. **PayPal.** Falta o endereço `paypal.me` para o campo `APOIO.paypal`.
3. **Backend do pulso.** Ver secção 8 do README.
4. **Páginas que o concorrente tem e nós não:** `/comunidade`, `/leaderboard`,
   `/galeria`, `/aprender`.

## Documentação mais longa

O [README.md](README.md) tem o guia completo: fontes de dados, monetização,
como funciona o gerador de leituras e como publicar.

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
  $n = $c -replace '(css/style\.css|js/app\.js|js/world-path\.js|js/bandeiras\.js)\?v=\d+','$1?v=NOVO'
  if ($n -ne $c) { Set-Content $_.FullName $n -Encoding UTF8 }
}
```

## Onde se configuram as coisas

Tudo em [js/app.js](js/app.js), no topo das respetivas secções:

| Bloco | Para quê |
|---|---|
| `SRC` | endereços de todas as APIs |
| `APOIO` | links do Stripe, meta mensal, apoiantes |
| `MENU` | painel de navegação, injetado em todas as páginas |
| `PULSO_API` | vazio; preencher para o pulso de sintomas ficar comunitário |
| `SINTOMAS` | lista de sintomas do bloco "Como se sente hoje" |

Acrescentar uma página ao site: criar o HTML e juntar uma linha ao `MENU`.

## A medição da Ressonância de Schumann

O medidor grande do painel mostra a **Ressonância de Schumann medida**: a
frequência onde está o pico da fundamental e a sua intensidade. Antes mostrava
o índice composto de energia (Kp + raios-X + sismos), que não tem nada de
Schumann e que qualquer visitante lia como sendo a leitura da Schumann.

**Não existe fonte pública com estes valores em número.** Foi verificado
ficheiro a ficheiro: Tomsk devolve conteúdo em `shm.jpg` e zero bytes em tudo o
resto (`data.txt`, `shm.csv`, `data.json`...). O HeartMath não tem API
documentada. Quem publica "F1 = 7,70 Hz" ao vivo está a ler da imagem ou a
inventar. Por isso o valor é extraído da própria imagem.

| Peça | O quê |
|---|---|
| [ler-schumann.py](ler-schumann.py) | lê o espectrograma, encontra os picos, converte cor em intensidade |
| [.github/workflows/schumann.yml](.github/workflows/schumann.yml) | corre de 30 em 30 min |
| branch `dados` | onde o resultado é publicado, **fora do projeto** |

A branch `dados` é reescrita a cada execução (`push --force` de uma branch
órfã), portanto tem sempre **um único commit** e não cresce. Foi essa a razão
da escolha: guardar o JSON dentro do projeto encheria o histórico de 48 commits
automáticos por dia. O painel lê de
`raw.githubusercontent.com/.../dados/schumann.json`, que envia
`Access-Control-Allow-Origin: *`.

**Porque não corre no navegador:** Tomsk não envia cabeçalhos CORS, logo os
pixels da imagem não são legíveis do lado do visitante. Tem de ser no servidor.

**Regras de honestidade, que são o ponto todo disto.** A leitura é recusada
quando o recetor está saturado (banda toda branca, cerca de 1 hora em cada 4),
quando o pico encosta ao limite da banda de procura, quando as cores não
correspondem à escala, ou quando a imagem muda de dimensões. Nesses casos
recua-se na própria imagem, que tem 72 horas, até à última medição válida, e
mostra-se essa **com a idade à vista**. Nunca se interpola nem se preenche.
Tudo documentado em [metodologia.html](metodologia.html).

A intensidade vem na escala de cor do espectrograma (0 a 100), **não em
picotesla**: Tomsk não publica a calibração. Isso está escrito na página.

## Preferências do utilizador, já manifestadas

- **Nada de travessões** (o traço longo, U+2014). Foi pedido explicitamente e
  limpou-se o site todo. Traços curtos em intervalos (0–40 Hz) são aceitáveis.
- **Nada de caixas de aviso médico.** Foram todas removidas por decisão dele.
- **Não falar de custos** na página de apoio. Falar do que o apoio permite.
- Respostas diretas, sem repetir explicações já dadas.
- Prefere que se faça e se verifique, em vez de se pedir confirmação a cada passo.

**Sobre alterações visuais, aprendido à força:**

- **Mostrar sempre uma imagem antes de publicar.** Descrever por palavras não
  chega e irrita. Ver a secção seguinte sobre como tirar capturas.
- **Nunca dizer que está feito sem ter olhado.** Houve um caso de texto por
  cima do medidor que passou em todas as verificações de texto e só se viu numa
  imagem. Medir geometria, não só conteúdo.
- Rejeitou uma proposta de redesenho completo (três direções: instrumento
  científico, editorial claro, refinar). Quer o site como está, com correções
  pontuais. **Não voltar a propor redesenhos globais.**
- Quando aponta um defeito visual, costuma mandar uma captura do concorrente
  como referência. Seguir essa referência de perto, não interpretar.
- Prefere **prosa limpa dentro de um cartão** a listas com etiquetas e linhas
  separadoras. Foi rejeitada uma versão em linhas rotuladas (Sol/Terra/Registo)
  e aceite a mesma informação em texto corrido.

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

**Cloudflare serve os endereços sem `.html`.** Um pedido a `/blog/x.html`
devolve 307 para `/blog/x`. Usar `curl -L`, senão parece que a página não
existe. Os `<link rel="canonical">` e o sitemap já apontam para a forma sem
`.html`, que é a que responde 200. **Os links internos ficam com `.html` de
propósito:** o servidor local (`python -m http.server`) não serve endereços sem
extensão, e mudá-los partia o desenvolvimento em troca de nada.

**A propagação da Cloudflare é irregular.** Durante um a dois minutos, uns nós
já servem a versão nova e outros a antiga. **Verificar com três pedidos por
tentativa, nunca com um só**, senão dá-se por concluído antes de estar, e o
utilizador vê a versão antiga logo a seguir a lhe dizermos que está feito. Foi
o que aconteceu várias vezes.

**Como tirar capturas de ecrã.** A pane do browser do Claude Code não compõe
imagem nesta máquina. O Chrome instalado tira capturas por linha de comandos, e
é assim que se verifica o aspeto:

```powershell
Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" -Wait -NoNewWindow -ArgumentList @(
  "--headless=new","--disable-gpu","--no-sandbox","--hide-scrollbars",
  "--user-data-dir=$perfil","--screenshot=$png","--window-size=1300,1000",
  "--virtual-time-budget=10000","http://localhost:4321/index.html")
```

Usar **um perfil novo de cada vez** (`$perfil` aleatório), senão o Chrome serve
o CSS da cache e mostra o resultado antigo. Para ver um bloco em detalhe,
recortar com PIL. **O modo sem interface não emula telemóvel a sério**: corta o
texto à direita e parece um defeito que não existe. Para telemóvel, medir com
JavaScript na página em vez de acreditar na imagem.

**As bandeiras emoji não funcionam no Windows.** O `🇯🇵` sai como `JP` em
letras no Chrome e no Edge, porque a Segoe UI Emoji não traz os desenhos das
bandeiras. Foi testado. Por isso as bandeiras da lista de sismos são
desenhadas em SVG pelo [js/bandeiras.js](js/bandeiras.js), 149 delas, feitas
com bandas, discos, cruzes e cantões. **Não trocar por emoji.**

A [folha-bandeiras.html](folha-bandeiras.html) mostra-as todas de uma vez, para
conferir cores e desenhos. É página de trabalho, está no `.assetsignore` e não
é servida. A esta escala, 20 px, um brasão é uma mancha da cor certa: é
deliberado e está explicado no cabeçalho do ficheiro. Um país que não esteja na
tabela fica com as duas letras, nunca com uma bandeira inventada.

**Os dois mapas.** Sismos e vulcões têm mapas separados, `#quake-map` e
`#volcano-map`, desenhados pela mesma `renderMapa(hostId, camadas)`. As marcas
de cada um vivem em `marcasPorMapa[hostId]`: havia uma lista só, e com dois
mapas na página o segundo apagava as marcas do primeiro. As abas
"Tudo / Só sismos / Só vulcões" foram removidas, já não faziam sentido.

**`set(id, html, cls)` em [js/app.js](js/app.js) substitui a classe toda.**
Passar só `"is-calm"` apaga `tile-value` e o número perde o tamanho grande.
Aconteceu em quatro mosaicos durante meses. Passar sempre `"tile-value " + cls`.

## Estado atual

Funciona sozinho, com **dois robôs**:

| Robô | Quando | O que faz |
|---|---|---|
| [leitura-diaria.yml](.github/workflows/leitura-diaria.yml) | 06:20 UTC | escreve `leitura/AAAA-MM-DD.html`, corre o `prerender.py`, atualiza sitemap e arquivo |
| [schumann.yml](.github/workflows/schumann.yml) | de 30 em 30 min | lê o espectrograma e publica o JSON na branch `dados` |

## A pré-renderização, e porque existe

O painel todo é preenchido por JavaScript. Para quem visita não faz diferença.
Para o Google faz: o que fica no índice é muitas vezes o HTML tal como sai do
servidor, e nesse HTML o medidor dizia "a carregar" e os mosaicos diziam "…".
O concorrente que aparece em primeiro lugar traz os números e uma data dentro
do próprio HTML, e é por isso que o resultado dele mostra ambos.

O [prerender.py](prerender.py) lê o mesmo `schumann.json` que o painel lê e
escreve os valores dentro do `index.html`, entre marcadores. Corre no fim do
robô diário. O JavaScript continua a mandar: mal os dados ao vivo chegam,
substitui o que lá estiver.

Duas regras, que são as mesmas do resto do projeto:

- **Tudo o que o script escreve leva a data da medição colada.** O ficheiro
  pode ficar 24 horas no ar, e se o JavaScript não correr é aquele texto que a
  pessoa lê. Daí "Na medição de 10 de agosto às 20:09 UTC" em vez de "agora".
- **Nada de idades escritas a duro** ("há 20 min"), que envelhecem no ficheiro.
  A idade real é posta pelo JavaScript.

A frase dos modos existe em duas cópias, `fraseModos()` em [js/app.js](js/app.js)
e `frase_modos()` no [prerender.py](prerender.py). **Ao mexer numa, mexer na
outra.** Se as marcações do `index.html` mudarem de forma, o script falha com
erro visível em vez de deixar de fazer nada em silêncio.

Ambos confirmados a funcionar em produção. As leituras dos dias 8, 9 e 10 de
agosto de 2026 foram geradas sem intervenção, já com a marca nova, e o
`normalizar_versoes()` alinhou sozinho a versão de cache das anteriores.

Painel ao vivo, e-mail `geral@ressonanciaschumannhoje.com`, donativos Stripe
ligados, meta mensal de 50 euros.

**Sobre o nome no cabeçalho.** O logótipo diz "Ressonância Schumann Hoje", sem
a preposição, por decisão dele. O `<h1>` da página inicial diz apenas
**"Ressonância de Schumann"**: ele mandou tirar o "Hoje" a 10 de agosto de 2026,
por aparecer duas vezes seguidas com o logótipo mesmo por cima. Não custou nada
em pesquisa, porque a expressão que ficou é exatamente a que se pesquisa. O
"Hoje" continua no `<title>`, que é o que aparece no Google. **Não voltar a
pô-lo no `h1`.**

**As duas barras do topo não têm largura máxima.** O cabeçalho e a barra de
apoio usam `max-width: none`, para a marca ficar no canto superior esquerdo em
qualquer monitor. Já tiveram 1180 px e depois 1400 px, e das duas vezes ele
voltou a reclamar: num ecrã de 1920 px, um limite de 1400 deixa 260 px de
margem de cada lado, que é o mesmo defeito outra vez. **Ao verificar isto, usar
uma janela larga**, senão o problema não aparece. O conteúdo das páginas
continua centrado nos 1180 px, e é assim que se quer.

**Por fazer, por ordem de retorno:**

1. **Artigos.** Temos 4, o concorrente tem 89. Continua a ser a maior lacuna.
   Dos 89 dele, só cerca de 12 são a sério (URL limpo, fontes reais); os outros
   77 têm carimbo de tempo no URL, um por dia, e são geração automática sem
   fontes. **Copiar os temas dos 12, ignorar os 77.** Palavras-chave na secção 7
   do [README.md](README.md). Próximos sugeridos, por não colidirem com páginas
   que já temos: "Ressonância de Schumann e sono" e "é comprovada pela ciência?".
2. **Ligações de fora.** É o que falta para passar do 6.º ao 3.º lugar em
   "ressonância schumann". O trabalho técnico está feito; o domínio tem dias de
   vida e ninguém aponta para ele. O [incorporar.html](incorporar.html) é a
   melhor peça que temos para isso: quem põe o widget num site põe também uma
   ligação. Ver a secção 12 do [README.md](README.md).
3. **Backend do pulso.** Ver secção 8 do README.
4. **Páginas que o concorrente tem e nós não:** `/comunidade`, `/leaderboard`,
   `/galeria`, `/aprender`.

**PayPal: fora, por decisão dele.** O botão, o campo `APOIO.paypal` e o
separador "OU" foram removidos. Só Stripe. Não voltar a sugerir.

**Nada de destaques a empurrar um valor.** O cartão dos 15 € tinha uma etiqueta
verde "mais útil" e fundo verde. Foi retirada: lida como agressiva para quem
chega. Os quatro cartões são iguais e a escolha é do leitor.

**Os rótulos dos valores dizem o que o apoio sustenta**, com as peças do
próprio site (espectrograma, leituras diárias, painel), não o que custa nem
comparações de fora. "Um café" e "um mês de site" foram rejeitados.

**A janela de convite a apoiar** (`wireConviteApoio()` em [js/app.js](js/app.js))
foi feita a pedido dele, a copiar o formato do concorrente, mas sem as três
coisas que ele já tinha mandado tirar: o destaque "popular" num dos valores, o
PayPal, e a conversa dos custos. O que lá está sai do bloco `APOIO`, portanto
os números são os verdadeiros e mantêm-se sozinhos.

As regras de convivência estão no comentário da função e **não se afrouxam sem
ele pedir**: nunca a quem chega pela primeira vez (só ao terceiro dia diferente
de visita), uma vez por sessão, depois de 40 segundos ou 55% da página, nunca
na página de apoio, fechar adia 30 dias, clicar num valor adia 180. A regra dos
três dias não é só delicadeza: o Google despromove sites que atiram janelas por
cima do conteúdo a quem chega de uma pesquisa no telemóvel, e assim nem o
visitante vindo da pesquisa nem o robô chegam a ver aquilo.

**Para fotografar o convite ou o menu**, criar uma página de teste temporária
na raiz que semeie o `localStorage` e deixe o `--virtual-time-budget` adiantar
o temporizador. Apagá-la a seguir. Ver o histórico do commit do convite.

**Cuidado ao escrever artigos novos:** verificar primeiro se já existe uma
página do site para essa pesquisa. O artigo sobre o índice Kp foi abandonado a
meio por competir com a [indice-kp-agora.html](indice-kp-agora.html), que já
cobre o mesmo termo. Duas páginas nossas na mesma pesquisa dividem força em vez
de somar.

## Documentação mais longa

O [README.md](README.md) tem o guia completo: fontes de dados, monetização,
como funciona o gerador de leituras e como publicar.

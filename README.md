# Ressonância de Schumann Hoje

Site estático, em português, com painel ao vivo da Ressonância de Schumann e do clima espacial.
Equivalente ao `schumannresonance.today`, mas com conteúdo original e dados verificáveis.

Sem framework, sem build, sem dependências. É HTML + CSS + um ficheiro JavaScript.

---

## 1. Ver o site localmente

```bash
python -m http.server 4321
```

Depois abra `http://localhost:4321`.

> Abrir o `index.html` com duplo clique (protocolo `file://`) faz falhar os pedidos às APIs
> por causa de CORS. Use sempre um servidor local.

---

## 2. Estrutura

```
index.html          Painel ao vivo (a página principal)
sintomas.html       Sintomas relatados + o que a ciência diz
faq.html            Perguntas frequentes (com marcação FAQ para o Google)
metodologia.html    Fontes, fórmulas e limitações, página de credibilidade
sobre.html          Quem faz e política editorial
apoiar.html         Donativos
privacidade.html    Modelo RGPD (a preencher)
termos.html         Modelo de termos (a preencher)
blog/               Quatro artigos longos, prontos a indexar
leitura/            Arquivo das leituras diárias, uma página por dia
css/style.css       Todo o estilo
js/app.js           Toda a lógica: APIs, gráficos SVG, fase da Lua, relógios
assets/favicon.svg
robots.txt · sitemap.xml · ads.txt · wrangler.jsonc

gerar-leitura.py    Escreve a leitura do dia (secção 8)
ler-schumann.py     Extrai a medição da Schumann do espectrograma (secção 9)
.github/workflows/  Os dois robôs que correm sozinhos
```

Os `.py` ficam no repositório mas **não são servidos** como parte do site: o
[.assetsignore](.assetsignore) trata disso.

---

## 3. De onde vêm os dados

Tudo é obtido pelo navegador do visitante, diretamente das fontes. Não há servidor nem base de dados.

| Dado | Fonte | Custo |
|---|---|---|
| Espectrograma 7,83 Hz | `sos70.ru/provider.php?file=shm.jpg`, Space Observing System, Univ. de Tomsk | grátis |
| Índice Kp, raios-X, erupções, alertas, previsão 3 dias | `services.swpc.noaa.gov`, NOAA SWPC | grátis, domínio público |
| Auroras (OVATION), ionosfera (D-RAP), imagens SUVI do Sol | NOAA SWPC | grátis, domínio público |
| Sismos M4,5+ | `earthquake.usgs.gov`, USGS | grátis, domínio público |
| Fase da Lua | calculada no navegador |, |

**Nota importante sobre Tomsk:** as imagens da NOAA e do USGS são domínio público e podem ser
usadas livremente. A imagem de Tomsk pertence à universidade, mantenha sempre a atribuição
visível (já está no rodapé do cartão). É uma estação de investigação: falhas são normais, e o
site já mostra uma mensagem quando a imagem não carrega.

> ⚠️ **Endereço antigo não usar.** `sosrff.tsu.ru/new/shm.jpg` deixou de ser atualizado em
> **1 de setembro de 2025** e continua online, congelado nessa data. Muitos sites ainda o
> publicam como se fosse ao vivo. O feed atual é `sos70.ru/provider.php?file=shm.jpg`.
> Verificação: as datas impressas no topo da imagem têm de corresponder aos últimos 3 dias.

### Como confirmar que os dados são reais

O painel tem um bloco **"Estado das fontes em tempo real"** que mostra, para cada fonte, quando
respondeu pela última vez. Verde = recebido agora. Vermelho = sem resposta. Se uma fonte cair,
o site diz-o em vez de mostrar valores velhos.

Verificação manual de qualquer fonte, a partir do PowerShell:

```powershell
(Invoke-WebRequest 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json' -UseBasicParsing).Headers['Last-Modified']
```

---

## 4. Publicar (10 minutos, grátis)

1. Registe um domínio. Sugestões livres à data de escrita: `ressonanciaschumann.pt`,
   `ressonanciadeschumann.com.br`, `schumannhoje.com`. Custa 10–15 €/ano.
2. Vá a **app.netlify.com/drop** e arraste a pasta inteira. Fica online em segundos, com HTTPS.
   (Alternativas equivalentes: Cloudflare Pages, Vercel, GitHub Pages.)
3. Ligue o seu domínio nas definições da Cloudflare.
4. Substitua `ressonanciaschumannhoje.com` em todos os ficheiros. No PowerShell, a partir da pasta do site:

```powershell
Get-ChildItem -Recurse -Include *.html,*.xml,*.txt | ForEach-Object { (Get-Content $_.FullName -Raw) -replace 'SEU-DOMINIO\.com','oseudominio.pt' | Set-Content $_.FullName -Encoding utf8 }
```

5. Substitua também `SEU-EMAIL@exemplo.com` e os campos `[entre parênteses retos]` em
   `privacidade.html` e `termos.html`.
6. Registe o site no **Google Search Console** e submeta `sitemap.xml`.

---

## 5. Monetização

### Como é que o site original ganha dinheiro

Vale a pena perceber, porque não é com publicidade. O `schumannresonance.today` diz-se
explicitamente "sem anúncios" e vive de:

1. **Produtos digitais próprios**: um relatório de numerologia a 111 $, um PDF a 80 $, um áudio
   guiado a 11 $. Margem quase total, sem stock, sem envio. É daqui que vem a maior parte.
2. **Afiliados de hardware**: um "gerador de frequência" a 199 $.
3. **Donativos**: Stripe, PayPal e apoio mensal, com barra de progresso mensal visível.

Ou seja: o painel ao vivo é o íman de tráfego; o dinheiro vem do que se vende a esse tráfego.

### Ordem recomendada para si

**Fase 1, primeiros 3 meses: publicar e crescer.**
Não monetize nada além de um botão de donativo. Publique um artigo novo por semana. O objetivo
é ter conteúdo e visitas suficientes para ser aceite pelas redes publicitárias.

**Fase 2, AdSense (opcional, atualmente desativado).**
> Os blocos de anúncio e a secção de afiliados **foram removidos do site** por opção, o
> `index.html` está limpo, e as páginas legais dizem que a única receita são donativos.
> Se um dia quiser publicidade, tem de repor os blocos *e* atualizar `apoiar.html`,
> `sobre.html` e `termos.html`, senão essas páginas ficam a mentir.

Candidate-se em `adsense.google.com` quando tiver ~20 artigos e tráfego orgânico consistente.
Depois de aprovado: cole o script no `<head>` do `index.html` (há um comentário a marcar o
sítio), insira as unidades de anúncio onde quiser, ponha a linha `google.com, pub-…` no
`ads.txt`, e ative um aviso de cookies (obrigatório na UE).

Expectativa realista: tráfego em português rende cerca de **1 a 4 € por cada 1000 páginas vistas**.
100 000 páginas vistas por mês ≈ 100–400 €/mês. Não é dinheiro rápido, e é a razão pela qual
vale mais a pena saltar direto para a fase 4.

**Fase 3, afiliados (também removida).**
Se quiser reintroduzir, use `rel="sponsored nofollow noopener"` em cada ligação, é exigência
do Google, e identifique a secção como patrocinada. Rende tipicamente mais por visita do que
a publicidade.

**Fase 4, produto próprio (onde está o dinheiro a sério).**
Um e-book em PDF, um curso curto ou um relatório personalizado. Vender 30 unidades a 15 €
rende mais do que 100 000 páginas vistas de AdSense. Ferramentas: Gumroad, Lemon Squeezy ou
Stripe Payment Links.

**Fase 5, boletim por e-mail.**
O formulário na página inicial já existe; falta apontar o `action` para o serviço
(MailerLite, Buttondown ou Beehiiv têm planos gratuitos até alguns milhares de subscritores).
Uma lista de e-mail é o único ativo que não depende do algoritmo do Google.

### Donativos

Em `apoiar.html`, substitua os `href="#"` por:
- **Stripe Payment Links**: `stripe.com` → Payments → Payment Links (o mais profissional);
- **Ko-fi** ou **Buy Me a Coffee**: mais rápidos de configurar;
- **PayPal.me**: o mais simples de todos.

---

## 6. Regras que não deve quebrar

Não são conselhos de estilo: quebrá-las é a forma mais rápida de perder o AdSense e o
posicionamento no Google.

1. **Não prometa efeitos de saúde.** O Google aplica critérios apertados a conteúdo que possa
   afetar a saúde ou o dinheiro das pessoas. Afirmar que a Ressonância de Schumann causa sintomas
   é falso e é penalizado. Os avisos já incluídos em cada página protegem-no, mantenha-os.
2. **Não copie texto de outros sites.** Todo o conteúdo aqui é original. Se acrescentar artigos,
   escreva-os.
3. **Identifique sempre as ligações patrocinadas.**
4. **Cumpra o RGPD.** Aviso de cookies antes de carregar publicidade, e política de privacidade
   preenchida a sério.
5. **Mantenha a atribuição a Tomsk, à NOAA e ao USGS.**

A página `metodologia.html` é a mais importante do site para a credibilidade, é ela que o
distingue das dezenas de páginas que publicam números inventados. Não a remova.

---

## 7. Ideias de artigos para crescer no Google


Palavras-chave com procura real em português e pouca concorrência de qualidade:

- "ressonância de schumann hoje" · "ressonância de schumann ao vivo"
- "o que é a ressonância de schumann"
- "7 83 hz o que significa"
- "tempestade geomagnética hoje" · "índice kp hoje"
- "aurora boreal em portugal" (pico de procura em cada tempestade forte)
- "sintomas tempestade solar"
- "erupção solar hoje"
- "o que é o índice kp"

Uma página por tema, cada uma ligada ao painel ao vivo. É assim que o tráfego cresce.

---

## 8. Leituras diárias: o motor de tráfego

O concorrente tem **236 páginas no sitemap**, mas só uma é o painel. As outras 235 são
conteúdo: 116 leituras diárias e 89 artigos. É daí que vem o tráfego dele, não do painel.

Replicámos o mecanismo com [gerar-leitura.py](gerar-leitura.py):

```bash
python gerar-leitura.py
```

Cada execução:

1. lê os dados do momento na NOAA, no USGS e na NASA;
2. escreve `leitura/AAAA-MM-DD.html`, com título, resumo, quatro indicadores e seis parágrafos
   construídos a partir dos números;
3. reconstrói as ligações "anterior / seguinte" de todas as leituras, formando uma cadeia que o
   Google percorre;
4. regenera `leitura/index.html` e o `sitemap.xml`.

Ao fim de um ano são 365 páginas indexadas, cada uma a apanhar pesquisas do género
"ressonância de schumann 5 de agosto".

**Corre sozinho** com a GitHub Action em
[.github/workflows/leitura-diaria.yml](.github/workflows/leitura-diaria.yml), todos os dias às
06:20 UTC. Faz commit e a Cloudflare publica. Não custa nada.

### Duas decisões que valem a pena manter

**Não gera datas passadas.** As APIs só dão o estado atual, por isso escrever
`leitura/2026-08-04.html` hoje colocaria os números de hoje sob a data de ontem. O script recusa,
a menos que se passe `--forcar`, que existe apenas para testes. Nunca use isso para encher o
arquivo: seria fabricar registos, e é o tipo de coisa que destrói a credibilidade toda de uma vez.

**Não fala de sintomas.** As leituras do concorrente dizem coisas como *"some people report
fragmented sleep"*. As nossas descrevem condições e consequências verificáveis: GPS, rádio,
auroras. Igualmente útil, e sem o risco de ser penalizado por conteúdo de saúde sem base.

## 9. A medição da Ressonância de Schumann

O medidor grande do painel mostra a Ressonância de Schumann medida: a frequência onde está o
pico da fundamental e a sua intensidade. Não é o índice composto de energia, que continua no
mosaico ao lado, identificado como composto.

**Não existe fonte pública com estes valores em número.** Foi verificado ficheiro a ficheiro:
a estação de Tomsk devolve conteúdo em `shm.jpg` e zero bytes em tudo o resto. Quem publica
"F1 = 7,70 Hz" ao vivo está a ler da imagem ou a inventar. Por isso o valor é extraído da
própria imagem publicada, com [ler-schumann.py](ler-schumann.py):

```bash
pip install pillow numpy
python ler-schumann.py
```

Cada execução localiza a coluna de tempo mais recente com dados, procura a linha mais intensa
dentro da banda de cada modo (fundamental entre 6,6 e 9,2 Hz) e converte a cor em número usando
a barra de cores da própria imagem como escala.

**Corre sozinho** com a GitHub Action em
[.github/workflows/schumann.yml](.github/workflows/schumann.yml), de 30 em 30 minutos, e publica
o resultado na branch `dados`. Essa branch é reescrita a cada execução, portanto tem sempre um
único commit e não enche o histórico do projeto. O painel lê o JSON diretamente do GitHub.

### As regras que fazem isto valer alguma coisa

A leitura é **recusada**, e não apresentada, quando o recetor está saturado, quando o pico
encosta ao limite da banda de procura, quando as cores não correspondem à escala, ou quando a
imagem muda de formato. No espectrograma analisado, a saturação ocupava 19 das 72 horas.

Quando a hora atual não dá leitura de confiança, recua-se na própria imagem, que cobre 72 horas,
até à última medição válida, e mostra-se essa **com a idade à vista**. O número apresentado é
sempre uma medição real que aconteceu. Nunca é interpolado nem estimado.

**O que este número não é:** não está calibrado em picotesla, porque Tomsk não publica a
calibração; não é um valor planetário, é a cavidade vista da Sibéria; e não é uma grandeza
padronizada, ao contrário do índice Kp. Está tudo escrito em
[metodologia.html](metodologia.html).

## 10. O "Como se sente hoje?", tornar comunitário

O bloco de sintomas por baixo do espectrograma já funciona: o visitante escolhe o que sente, e o
ranking que aparece é a contagem **real** dos registos dele nos últimos 30 dias, guardados em
`localStorage`. Nada sai do dispositivo, e o rodapé diz isso.

Deliberadamente **não** vem com votos de outras pessoas inventados. Um "Top 10 do que as pessoas
sentem hoje" com números fabricados é uma mentira ao visitante e, se alguém reparar, destrói a
credibilidade que a página de metodologia constrói.

Para o tornar verdadeiramente comunitário precisa de um backend. O mais simples e gratuito:

1. Crie um projeto em **Supabase** (plano gratuito) com uma tabela `pulso(dia date, sintoma text)`.
2. Crie um Cloudflare Worker ou uma Supabase Edge Function que:
   - em `POST {dia, sintomas:[...]}` insira uma linha por sintoma;
   - em `GET` devolva `{ total: n, contagens: { id: n } }` das últimas 24 horas.
3. Em [js/app.js](js/app.js), ponha o URL na constante `PULSO_API` (está no topo do bloco "Pulso").

Assim que `PULSO_API` deixar de estar vazia, o rodapé do bloco passa sozinho a dizer "registos
partilhados por todos os visitantes". Terá ainda de:

- limitar votos por IP ou por sessão, senão qualquer pessoa enche o ranking;
- acrescentar o backend à lista de terceiros em `privacidade.html`;
- decidir se guarda o IP (se guardar, é dado pessoal e tem de o declarar).

**Nota de honestidade editorial:** quando este bloco tiver dados de muita gente, vai ser tentador
apresentá-lo como prova de que a Ressonância de Schumann causa sintomas. Não é, mede quem visita
o site e o que essa pessoa espera sentir. O aviso já incluído no bloco explica isso; mantenha-o.

## 11. Personalizar

- **Cores:** as variáveis estão no topo de `css/style.css` (`:root`).
- **Fórmula do índice:** função `computeIndex()` em `js/app.js`, se a alterar, atualize também
  a tabela em `metodologia.html`, senão o site passa a mentir.
- **Fontes de dados:** objeto `SRC` no topo de `js/app.js`.
- **Fusos horários dos relógios:** array `ZONES` em `js/app.js`.


/* Service worker mínimo, só para o site poder ser instalado.
   ============================================================================

   O Chrome só oferece "Instalar" a um site que tenha manifesto e um service
   worker com tratador de "fetch". É isso que este ficheiro faz, e mais nada.

   NÃO guarda nada em cache, de propósito. Isto é um painel ao vivo: um
   service worker a servir cópias guardadas mostraria um índice Kp de ontem
   com ar de atual, que é exatamente o defeito de que acusamos os outros
   sites. Todos os pedidos passam direto para a rede.

   Se um dia se quiser funcionamento sem ligação, a única coisa que pode ser
   guardada com honestidade é a estrutura da página, nunca os números, e o que
   estiver guardado tem de aparecer com a data à vista. Ver metodologia.html.
   ============================================================================ */

self.addEventListener("install", function () {
  // Assume o controlo sem esperar que os separadores antigos fechem.
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  // Limpa qualquer cache que uma versão futura tenha deixado para trás.
  e.waitUntil(
    caches.keys()
      .then(function (nomes) { return Promise.all(nomes.map(function (n) { return caches.delete(n); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  // Passagem direta. O tratador existe porque o navegador exige um para
  // considerar o site instalável, não para intermediar coisa nenhuma.
  e.respondWith(fetch(e.request));
});

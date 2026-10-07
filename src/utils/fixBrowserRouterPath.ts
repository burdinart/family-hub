// src/utils/fixBrowserRouterPath.ts — поддержка прямых заходов на маршруты при SPA-деплое
// в подпапке (GitHub Pages): 404.html редиректит на index.html с hash #redirect=<путь>.
// Здесь вырезаем этот hash из адреса ДО создания BrowserRouter, чтобы router сам
// подхватил корректный pathname (без ручного чтения sessionStorage).
export function stripRedirectHash(): void {
  const match = window.location.hash.match(/^#redirect=(.*)$/);
  if (!match) return;
  const target = decodeURIComponent(match[1]);
  // Заменяем URL без истории: BrowserRouter при инициализации прочитает новый pathname.
  history.replaceState(null, '', target);
}

// Вызываем один раз на модульном уровне main.tsx — до первого рендера.
stripRedirectHash();

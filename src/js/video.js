// Videos load shortly before they reach the viewport and pause as soon as they leave it.
// <video data-lazy preload="none"> with <source data-src> children; data-autoplay plays while visible.
export function lazyVideos({ reduce }) {
  const videos = [...document.querySelectorAll('video[data-lazy]')];
  const load = (v) => {
    if (v.dataset.loaded) return;
    v.querySelectorAll('source[data-src]').forEach((s) => (s.src = s.dataset.src));
    v.dataset.loaded = '1';
    v.load();
  };
  const near = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && load(e.target)),
    { rootMargin: '100% 0px' },
  );
  const visible = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        load(v);
        if (!reduce && v.dataset.autoplay !== undefined) v.play().catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    }
  });
  videos.forEach((v) => {
    near.observe(v);
    visible.observe(v);
  });
  return { load };
}

import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initNav({ lenis }) {
  const nav = document.querySelector('.nav');
  const btn = nav.querySelector('.nav__menu');
  const menu = document.getElementById('menu');
  let forced = null;

  function setTheme(theme) {
    if (forced) return;
    if (nav.dataset.theme !== theme) nav.dataset.theme = theme;
  }

  // Sections declare their tone; the capsule follows whichever one sits under it.
  document.querySelectorAll('main section:not(.hero)[data-theme], body > footer[data-theme]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 40px',
      end: 'bottom 40px',
      // measured after every pinned section has added its scroll space further up the page
      refreshPriority: -1,
      onToggle: (self) => self.isActive && setTheme(sec.dataset.theme),
    });
  });

  function scrollToHash(hash) {
    const target = document.querySelector(hash);
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else target.scrollIntoView({ behavior: 'smooth' });
  }

  function toggle(open) {
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      forced = null;
      nav.dataset.theme = 'dark';
      forced = 'dark';
      lenis?.stop();
    } else {
      menu.classList.remove('is-open');
      forced = null;
      lenis?.start();
      ScrollTrigger.update();
      setTimeout(() => { if (btn.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 800);
    }
  }

  btn.addEventListener('click', () => toggle(btn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    toggle(false);
    scrollToHash(a.getAttribute('href'));
  });
  // in-page links anywhere (capsule, footer, call to action) glide instead of jumping
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || menu.contains(a)) return;
    e.preventDefault();
    // a contact that is not filled in yet stays where it is
    if (a.classList.contains('is-soon') && a.closest('.footer')) return;
    scrollToHash(a.getAttribute('href'));
  });
  window.addEventListener('keydown', (e) => e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true' && toggle(false));

  return { setTheme };
}

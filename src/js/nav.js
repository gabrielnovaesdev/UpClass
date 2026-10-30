import { ScrollTrigger } from 'gsap/ScrollTrigger';

// the capsule's tone, for the stages that drive it themselves (hero.js, evo-section.js); see initNav
let requestTheme = () => {};
export const setNavTheme = (theme) => requestTheme(theme);

export function initNav({ lenis, reduce }) {
  const nav = document.querySelector('.nav');
  const btn = nav.querySelector('.nav__menu');
  const menu = document.getElementById('menu');
  let forced = null;
  let wanted = nav.dataset.theme || 'dark'; // what the page under it asks for, kept while the menu forces dark

  function setTheme(theme) {
    wanted = theme;
    if (forced) return;
    if (nav.dataset.theme !== theme) nav.dataset.theme = theme;
  }
  requestTheme = setTheme;

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
  // with motion the hero's hand-over sets the tone itself (hero.js); without it, the hero is simply dark
  if (reduce) {
    ScrollTrigger.create({
      trigger: '.hero', start: 'top top', end: 'bottom 40px', refreshPriority: -1,
      onToggle: (self) => self.isActive && setTheme('dark'),
    });
  }

  function scrollToHash(hash) {
    if (!hash || hash.length < 2) return;
    const target = document.querySelector(hash);
    if (!target) return;
    // the skip link (and any jump) takes keyboard focus along, not only the view
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else target.scrollIntoView({ behavior: 'smooth' });
  }

  function toggle(open) {
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      menu.hidden = false;
      document.documentElement.classList.add('menu-open');
      requestAnimationFrame(() => menu.classList.add('is-open'));
      forced = null;
      nav.dataset.theme = 'dark';
      forced = 'dark';
      lenis?.stop();
    } else {
      menu.classList.remove('is-open');
      document.documentElement.classList.remove('menu-open');
      forced = null;
      setTheme(wanted); // back to the tone of whatever is under it now
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

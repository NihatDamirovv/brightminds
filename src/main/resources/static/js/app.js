(function() {

  const navLinks = document.getElementById('navLinks');
  const navToggle = document.getElementById('navToggle');
  const sections = document.querySelectorAll('.section');

  // Each section has its own URL, e.g. /contact (server serves index.html for these paths)
  const ROUTES = { home: '/', mental: '/mental', methodology: '/books', about: '/about', contact: '/contact' };
  const TITLES = {
    home: 'Bright Minds Academy — Mental Arifmetika',
    mental: 'Mental Arifmetika — Bright Minds Academy',
    methodology: 'Kitablar — Bright Minds Academy',
    about: 'Haqqımızda — Bright Minds Academy',
    contact: 'Əlaqə — Bright Minds Academy',
  };
  const sectionFromPath = (path) => {
    const clean = path.replace(/\/+$/, '') || '/';
    return Object.keys(ROUTES).find((k) => ROUTES[k] === clean) || 'home';
  };

  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-section]');
    if (!link) return;
    const name = link.dataset.section;
    if (!name) return;
    // let ctrl/cmd/middle-click open the page in a new tab
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    navLinks.classList.remove('open');
    const path = ROUTES[name] || '/';
    if (location.pathname !== path) history.pushState({ section: name }, '', path);
    showSection(name);
  });

  window.addEventListener('popstate', () => showSection(sectionFromPath(location.pathname), false));

  function showSection(name, scroll = true) {
    sections.forEach(s => s.classList.remove('active'));
    navLinks.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    const target = document.getElementById('section-' + name);
    if (target) target.classList.add('active');
    const activeLink = navLinks.querySelector('[data-section="' + name + '"]');
    if (activeLink) activeLink.classList.add('active');
    document.title = TITLES[name] || TITLES.home;
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'methodology') {
      Methodology.loadBooks();
    } else {
      Methodology.resetAccess();
    }
  }

  // Hero flashing number — ambient life for the passport card
  const heroFlash = document.getElementById('heroFlash');
  if (heroFlash && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const nums = [7, 24, 3, 156, 9, 41, 8, 62, 5];
    let i = 0;
    setInterval(() => {
      heroFlash.style.opacity = 0;
      setTimeout(() => {
        i = (i + 1) % nums.length;
        heroFlash.textContent = nums[i];
        heroFlash.style.opacity = 1;
      }, 220);
    }, 1600);
    heroFlash.style.transition = 'opacity .22s ease';
  }

  MentalArithmetic.init();
  Methodology.init();
  showSection(sectionFromPath(location.pathname), false);

})();

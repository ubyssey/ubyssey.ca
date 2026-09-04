function initializeRedesignNavigation() {
  const header = document.querySelector('[data-home-nav]');
  if (!header) return;
  const button = header.querySelector('.hp-nav__menu');
  const menu = header.querySelector('#hp-expanded-menu');
  let open = false;
  let closeTimer;
  const setOpen = (nextOpen) => {
    open = nextOpen;
    window.clearTimeout(closeTimer);
    button.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    if (open) {
      menu.hidden = false;
      window.requestAnimationFrame(() => header.classList.add('menu-is-open'));
      menu.querySelector('input')?.focus({ preventScroll: true });
    } else {
      header.classList.remove('menu-is-open');
      closeTimer = window.setTimeout(() => { menu.hidden = true; }, 320);
    }
  };
  button.addEventListener('click', () => setOpen(!open));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) { setOpen(false); button.focus(); }
  });
  document.addEventListener('click', (event) => {
    if (open && !header.contains(event.target)) setOpen(false);
  });
  const updateHeader = () => {
    if (!header.classList.contains('is-compact') && window.scrollY > 96) {
      header.classList.add('is-compact');
    } else if (header.classList.contains('is-compact') && window.scrollY < 24) {
      header.classList.remove('is-compact');
    }
  };
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
}
function initializeGameAnalysis() {
  document.querySelectorAll('[data-game-analysis]').forEach((panel) => {
    panel.querySelectorAll('[data-score-panel]').forEach((scorePanel) => {
      const direction = scorePanel.dataset.scorePanel === 'recent' ? -1 : 1;
      const datedFixtures = [...scorePanel.querySelectorAll('.hp-fixture[data-starts-at]')];
      datedFixtures.sort((first, second) => direction * (new Date(first.dataset.startsAt) - new Date(second.dataset.startsAt)));
      datedFixtures.forEach((fixture) => scorePanel.appendChild(fixture));
    });
    const buttons = panel.querySelectorAll('button[data-sport]');
    let selectedSport = '';
    const applySportFilter = () => {
      buttons.forEach((item) => item.classList.toggle('is-active', item.dataset.sport === selectedSport));
      panel.querySelectorAll('.hp-games__stories article[data-sport], .hp-fixture[data-sport]').forEach((item) => {
        item.hidden = Boolean(selectedSport) && item.dataset.sport !== selectedSport;
      });
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
      selectedSport = selectedSport === button.dataset.sport ? '' : button.dataset.sport;
      applySportFilter();
    }));
    applySportFilter();
    panel.querySelectorAll('[data-score-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        const selected = button.dataset.scoreTab;
        panel.querySelectorAll('[data-score-tab]').forEach((tab) => tab.classList.toggle('is-active', tab === button));
        panel.querySelectorAll('[data-score-panel]').forEach((scorePanel) => {
          const active = scorePanel.dataset.scorePanel === selected;
          scorePanel.hidden = !active;
          scorePanel.classList.toggle('is-active', active);
        });
      });
    });
  });
}
function initializeNewsletter() {
  const form = document.querySelector('.hp-newsletter__form');
  if (!form || form.dataset.configured === 'true') return;
  form.addEventListener('submit', (event) => event.preventDefault());
}
initializeRedesignNavigation();
initializeGameAnalysis();
initializeNewsletter();

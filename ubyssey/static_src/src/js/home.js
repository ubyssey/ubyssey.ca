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
  header.querySelectorAll('.hp-nav__nameplate, .hp-nav__compact-nameplate').forEach((nameplate) => {
    nameplate.addEventListener('click', (event) => {
      if (!document.querySelector('#newsletter')) return;
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  header.querySelector('.hp-nav__newsletter')?.addEventListener('click', (event) => {
    const target = document.querySelector('#newsletter');
    if (!target) return;
    event.preventDefault();
    const targetTop = target.getBoundingClientRect().top + window.scrollY - header.getBoundingClientRect().height;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) { setOpen(false); button.focus(); }
  });
  document.addEventListener('click', (event) => {
    if (open && !header.contains(event.target)) setOpen(false);
  });
  let compact = header.classList.contains('is-compact');
  let scrollFrame;
  let settlingCompactState = false;
  let previousScrollY = window.scrollY;
  const setCompact = (nextCompact) => {
    if (nextCompact === compact) return;
    compact = nextCompact;
    settlingCompactState = true;
    header.classList.toggle('is-compact', compact);
    // Collapsing a sticky element changes document layout. Chrome may emit a
    // compensating scroll event, which must not immediately reverse the state.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      previousScrollY = window.scrollY;
      settlingCompactState = false;
    }));
  };
  const updateHeader = () => {
    const scrollY = window.scrollY;
    const scrollingUp = scrollY < previousScrollY;
    previousScrollY = scrollY;
    if (settlingCompactState) return;
    if (!compact && scrollY > 96) {
      setCompact(true);
    } else if (compact && scrollingUp && scrollY < 24) {
      setCompact(false);
    }
  };
  updateHeader();
  window.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = undefined;
      updateHeader();
    });
  }, { passive: true });
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
      const cards = [...panel.querySelectorAll('[data-game-card]')];
      const visibleCards = selectedSport ? cards.filter((item) => item.dataset.sport === selectedSport) : cards;
      cards.forEach((item) => {
        item.hidden = !visibleCards.slice(0, 4).includes(item);
        item.classList.remove('is-lead', 'is-secondary');
      });
      visibleCards.slice(0, 4).forEach((item, index) => item.classList.add(index === 0 ? 'is-lead' : 'is-secondary'));
      panel.querySelectorAll('.hp-fixture[data-sport]').forEach((item) => {
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
          if (active && scorePanel.animate) {
            scorePanel.animate(
              [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }],
              { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
            );
          }
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

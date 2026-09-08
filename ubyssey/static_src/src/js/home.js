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
  // The mast is 72px tall on desktop. Collapse only after it has fully
  // cleared the viewport, then retain that same visual reading position when
  // the sticky header becomes shorter. The wide hysteresis prevents Chrome's
  // compensating scroll event from toggling the two header states repeatedly.
  const compactAt = 170;
  const expandAt = 40;
  const desktop = window.matchMedia('(min-width: 761px)');
  const setCompact = (nextCompact) => {
    if (nextCompact === compact) return;
    const previousHeight = desktop.matches ? header.getBoundingClientRect().height : 0;
    compact = nextCompact;
    settlingCompactState = true;
    header.classList.toggle('is-compact', compact);
    const nextHeight = desktop.matches ? header.getBoundingClientRect().height : 0;
    const layoutDelta = nextHeight - previousHeight;
    if (layoutDelta) window.scrollBy(0, layoutDelta);
    // Collapsing a sticky element changes document layout. Chrome may emit a
    // compensating scroll event, which must not immediately reverse the state.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      settlingCompactState = false;
    }));
  };
  const updateHeader = () => {
    const scrollY = window.scrollY;
    if (settlingCompactState) return;
    // Fixed hysteresis matches the regular navigation while the settling lock
    // absorbs Chrome's compensating scroll event after a height change.
    if (!compact && scrollY > compactAt) {
      setCompact(true);
    } else if (compact && scrollY < expandAt) {
      setCompact(false);
    }
  };
  if (!compact && window.scrollY > compactAt) {
    setCompact(true);
  } else {
    updateHeader();
  }
  window.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = undefined;
      updateHeader();
    });
  }, { passive: true });
  const refreshForViewport = () => {
    compact = header.classList.contains('is-compact');
    updateHeader();
  };
  if (desktop.addEventListener) desktop.addEventListener('change', refreshForViewport);
  else desktop.addListener(refreshForViewport);
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
    const resetButton = panel.querySelector('[data-game-analysis-reset]');
    let selectedSport = '';
    const applySportFilter = () => {
      buttons.forEach((item) => item.classList.toggle('is-active', item.dataset.sport === selectedSport));
      if (resetButton) {
        resetButton.disabled = !selectedSport;
        resetButton.setAttribute('aria-disabled', String(!selectedSport));
      }
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
    resetButton?.addEventListener('click', () => {
      if (!selectedSport) return;
      selectedSport = '';
      applySportFilter();
    });
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

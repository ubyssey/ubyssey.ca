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
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  header.querySelector('.hp-nav__newsletter')?.addEventListener('click', (event) => {
    const target = document.querySelector('#newsletter');
    if (!target) return;
    event.preventDefault();
    // Reaching the divider always puts the homepage into its compact state.
    // Reserve that final header height, not the larger masthead height that
    // happens to be present at the moment of the click.
    const compactHeaderHeight = window.matchMedia('(min-width: 761px)').matches ? 68 : 58;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - compactHeaderHeight;
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
    const previousHeight = header.getBoundingClientRect().height;
    compact = nextCompact;
    settlingCompactState = true;
    header.classList.toggle('is-compact', compact);
    const nextHeight = header.getBoundingClientRect().height;
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
    const stories = panel.querySelector('[data-game-stories]');
    const upcoming = panel.querySelector('[data-score-panel="upcoming"]');
    const recent = panel.querySelector('[data-score-panel="recent"]');
    if (!stories || !upcoming || !recent) return;
    const initial = { stories: stories.innerHTML, upcoming: upcoming.innerHTML, recent: recent.innerHTML };
    const responseCache = new Map();
    const buttons = panel.querySelectorAll('button[data-sport]');
    const resetButton = panel.querySelector('[data-game-analysis-reset]');
    const selectedSports = new Set();
    let requestToken = 0;
    let controller;
    let debounceTimer;
    let storyAnimation;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const emptyMessage = '<p class="hp-games__empty">Nothing here yet, check back later!</p>';
    const swapStories = async (html, token) => {
      storyAnimation?.cancel();
      if (!reduceMotion.matches && stories.animate && stories.querySelector('[data-game-card]')) {
        storyAnimation = stories.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-in' });
        try { await storyAnimation.finished; } catch (_) { /* Superseded by another selection. */ }
      }
      if (token !== requestToken) return;
      stories.innerHTML = html || emptyMessage;
      stories.classList.toggle('has-cards', Boolean(stories.querySelector('[data-game-card]')));
      if (!reduceMotion.matches && stories.animate) {
        storyAnimation = stories.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 170, easing: 'ease-out' });
      }
    };
    const showContent = async (content, token) => {
      await swapStories(content.stories, token);
      if (token !== requestToken) return;
      upcoming.innerHTML = content.upcoming || emptyMessage;
      recent.innerHTML = content.recent || emptyMessage;
      panel.setAttribute('aria-busy', 'false');
    };
    const updateControls = () => {
      buttons.forEach((item) => {
        const selected = selectedSports.has(item.dataset.sport);
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      if (resetButton) {
        resetButton.disabled = selectedSports.size === 0;
        resetButton.setAttribute('aria-disabled', String(selectedSports.size === 0));
      }
    };
    const loadSelection = () => {
      requestToken += 1;
      const token = requestToken;
      window.clearTimeout(debounceTimer);
      controller?.abort();
      controller = undefined;
      updateControls();
      if (!selectedSports.size) {
        showContent(initial, token);
        return;
      }
      const sports = [...selectedSports].sort();
      const key = sports.join(',');
      const cached = responseCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        showContent(cached.content, token);
        return;
      }
      panel.setAttribute('aria-busy', 'true');
      swapStories('<p class="hp-games__empty" role="status">Loading stories…</p>', token);
      upcoming.innerHTML = '<p class="hp-games__empty" role="status">Loading games…</p>';
      recent.innerHTML = '<p class="hp-games__empty" role="status">Loading games…</p>';
      debounceTimer = window.setTimeout(async () => {
        controller = new AbortController();
        const params = new URLSearchParams();
        sports.forEach((sport) => params.append('sport', sport));
        try {
          const response = await fetch(`${panel.dataset.filterUrl}?${params}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
          });
          if (!response.ok) throw new Error(`Game Analyses request failed: ${response.status}`);
          const content = await response.json();
          if (token !== requestToken) return;
          responseCache.set(key, { content, expiresAt: Date.now() + 60000 });
          await showContent(content, token);
        } catch (error) {
          if (token !== requestToken || error.name === 'AbortError') return;
          await swapStories('<p class="hp-games__empty" role="alert">Couldn’t load stories. <button type="button" data-game-retry>Try again</button></p>', token);
          if (token !== requestToken) return;
          upcoming.innerHTML = '<p class="hp-games__empty" role="alert">Couldn’t load games. Please try again.</p>';
          recent.innerHTML = '<p class="hp-games__empty" role="alert">Couldn’t load games. Please try again.</p>';
          stories.querySelector('[data-game-retry]')?.addEventListener('click', loadSelection);
          panel.setAttribute('aria-busy', 'false');
        }
      }, 150);
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
      if (selectedSports.has(button.dataset.sport)) selectedSports.delete(button.dataset.sport);
      else selectedSports.add(button.dataset.sport);
      loadSelection();
    }));
    resetButton?.addEventListener('click', () => {
      if (selectedSports.size === 0) return;
      selectedSports.clear();
      loadSelection();
    });
    updateControls();
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

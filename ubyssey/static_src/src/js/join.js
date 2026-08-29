const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function setAccordionState(details, expanded) {
  const summary = details.querySelector(':scope > summary');
  if (summary) {
    summary.setAttribute('aria-expanded', String(expanded));
  }
}

function finishAccordionAnimation(details, expanded) {
  details.style.height = '';
  details.style.overflow = '';
  details.dataset.animating = '';
  details.open = expanded;
  setAccordionState(details, expanded);
}

function toggleAccordion(details) {
  const summary = details.querySelector(':scope > summary');
  if (!summary || details.dataset.animating === 'true') {
    return;
  }

  const expanded = !details.open;
  if (reduceMotion.matches) {
    details.open = expanded;
    setAccordionState(details, expanded);
    return;
  }

  details.dataset.animating = 'true';
  const startHeight = `${details.offsetHeight}px`;

  if (expanded) {
    details.open = true;
  }

  const endHeight = expanded
    ? `${summary.offsetHeight + details.querySelector('.join-accordion__content').offsetHeight}px`
    : `${summary.offsetHeight}px`;

  details.style.height = startHeight;
  details.style.overflow = 'hidden';

  const animation = details.animate(
    { height: [startHeight, endHeight] },
    { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
  );

  animation.onfinish = () => finishAccordionAnimation(details, expanded);
  animation.oncancel = () => finishAccordionAnimation(details, expanded);
}

document.querySelectorAll('[data-join-accordion]').forEach((details) => {
  const summary = details.querySelector(':scope > summary');
  if (!summary) {
    return;
  }

  setAccordionState(details, details.open);
  summary.addEventListener('click', (event) => {
    event.preventDefault();
    toggleAccordion(details);
  });
});

document.querySelectorAll('.join-page a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.hash);
    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
      block: 'start',
    });
    window.history.replaceState(null, '', link.hash);
  });
});

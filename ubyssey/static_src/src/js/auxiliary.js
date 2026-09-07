import './article_content';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.aux-tabs').forEach((tabs) => {
    tabs.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        tabs.querySelectorAll('a').forEach((item) => item.classList.remove('is-active'));
        link.classList.add('is-active');
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.history.replaceState(null, '', link.getAttribute('href'));
        }
      });
    });
    const form = tabs.querySelector('form');
    const input = form && form.querySelector('input[type="search"]');
    const button = form && form.querySelector('button');
    if (input && button) {
      button.addEventListener('click', (event) => {
        if (!input.value.trim() && document.activeElement !== input) {
          event.preventDefault();
          input.focus();
        }
      });
    }
  });
});

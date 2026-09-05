import './article_content';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.aux-tabs').forEach((tabs) => {
    tabs.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        tabs.querySelectorAll('a').forEach((item) => item.classList.remove('is-active'));
        link.classList.add('is-active');
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

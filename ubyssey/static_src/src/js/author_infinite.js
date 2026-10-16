/* Append one author-work page at a time as the reader reaches the end. */
(() => {
    const navigation = document.querySelector('[data-author-infinite]');
    const results = document.querySelector('#results');
    const nextLink = navigation?.querySelector('[data-author-next]');
    if (!navigation || !results || !nextLink || !('IntersectionObserver' in window)) return;

    const status = navigation.querySelector('[role="status"]');
    let loading = false;
    let nextUrl = nextLink.href;

    const loadNext = async () => {
        if (loading || !nextUrl) return;
        loading = true;
        nextLink.hidden = true;
        status.hidden = false;
        status.textContent = 'Loading more work…';

        try {
            const response = await fetch(nextUrl, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const page = new DOMParser().parseFromString(await response.text(), 'text/html');
            const moreResults = page.querySelector('#results');
            if (!moreResults || moreResults.className !== results.className) throw new Error('Invalid author results');
            results.append(...moreResults.children);

            const moreLink = page.querySelector('[data-author-next]');
            nextUrl = moreLink ? new URL(moreLink.getAttribute('href'), nextUrl).href : null;
            if (nextUrl) {
                nextLink.href = nextUrl;
                status.hidden = true;
                if (navigation.getBoundingClientRect().top < window.innerHeight + 300) {
                    setTimeout(loadNext, 0);
                }
            } else {
                navigation.remove();
                observer.disconnect();
            }
        } catch (error) {
            status.textContent = 'Could not load more work. Please try again.';
            nextLink.hidden = false;
        } finally {
            loading = false;
        }
    };

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) loadNext();
    }, { rootMargin: '300px 0px' });
    observer.observe(navigation);
    nextLink.addEventListener('click', (event) => {
        event.preventDefault();
        loadNext();
    });
})();

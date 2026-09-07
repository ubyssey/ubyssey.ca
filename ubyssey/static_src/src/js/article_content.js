import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let mm = gsap.matchMedia();
mm.add("(min-width: 1px), (min-height: 1px)", () => {

    // Attachments fade over the base attachment when scrolled into view
    var overlays = gsap.utils.toArray('.o-attachment-overlay--attachments');
    overlays.forEach((overlay) => {
        console.log(overlay);
        gsap.to(overlay, {
            scrollTrigger: {trigger: overlay, start: "40% center", end: "end center", scrub: true,  
                onEnter: self => {
                    self.trigger.classList.add("in-view");
                },
                onLeaveBack: self => {
                    self.trigger.classList.remove("in-view");
                },
            },
            immediateRender: false,
        });
    })
})

function initializeArticleNavigation() {
    const header = document.querySelector('[data-article-nav]');
    if (!header) return;
    const button = header.querySelector('.hp-nav__menu');
    const menu = header.querySelector('.hp-nav__expanded');
    let open = false;
    let closeTimer;
    const setOpen = (next) => {
        open = next;
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
    let compact = header.classList.contains('is-compact');
    let scrollFrame;
    const setCompact = (nextCompact) => {
        if (nextCompact === compact) return;
        compact = nextCompact;
        header.classList.toggle('is-compact', compact);
    };
    const update = () => {
        if (header.dataset.fullBleed === 'true') {
            const hero = document.querySelector('.ar-hero--full-bleed');
            if (!hero) return;
            const pastHero = window.scrollY >= hero.offsetTop + hero.offsetHeight - 8;
            header.classList.toggle('is-full-bleed-past', pastHero);
            setCompact(pastHero);
            return;
        }
        // The separate return threshold prevents a header-height change from
        // immediately reversing the state while the document is settling.
        setCompact(compact ? window.scrollY >= 16 : window.scrollY > 70);
    };
    update();
    window.addEventListener('scroll', () => {
        if (scrollFrame) return;
        scrollFrame = window.requestAnimationFrame(() => {
            scrollFrame = undefined;
            update();
        });
    }, { passive: true });
}

function formatCaptionCredits() {
    document.querySelectorAll('.ar-page figcaption .credit, .ar-page .caption .credit').forEach((credit) => {
        if (credit.querySelector('.credit-name')) return;
        const value = credit.textContent.trim();
        let match = value.match(/^(.*?\bby\s+)(.+?)(\s+for\s+The\s+Ubyssey.*)$/i);
        if (!match) match = value.match(/^(.*?\bby\s+)(.+)$/i);
        if (!match) return;
        credit.replaceChildren(
            document.createTextNode(match[1]),
            Object.assign(document.createElement('span'), { className: 'credit-name', textContent: match[2] }),
            document.createTextNode(match[3] || ''),
        );
    });
}

function initializeArticleSharing() {
    const copy = document.querySelector('[data-share-copy]');
    if (!copy) return;
    copy.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            copy.setAttribute('title', 'Link copied');
        } catch (_) {
            window.prompt('Copy this link', window.location.href);
        }
    });
}

function initializeKeepReading() {
    document.querySelectorAll('[data-keep-reading]').forEach((carousel) => {
        const next = carousel.querySelector('.ar-keep-reading__next');
        const current = carousel.querySelector('.ar-keep-reading__page span');
        if (!next || !current) return;
        const items = carousel.querySelectorAll('.ar-keep-reading__track > article');
        if (items.length <= 3) { next.hidden = true; return; }
        next.addEventListener('click', () => {
            const second = carousel.classList.toggle('is-page-two');
            current.textContent = second ? '02' : '01';
            next.textContent = second ? '←' : '→';
        });
    });
}

function alignArticleContextRail() {
    const body = document.querySelector('.ar-body');
    const rail = document.querySelector('.ar-reading__layout > .ar-context-rail');
    if (!body || !rail || window.matchMedia('(max-width: 800px)').matches) return;
    const paragraphs = [...body.querySelectorAll('p')].filter((paragraph) => !paragraph.closest('.o-extra-article-info, .ar-context-mobile, .ar-report'));
    if (paragraphs.length > 1) {
        rail.style.top = `${Math.max(0, paragraphs[1].getBoundingClientRect().top - body.getBoundingClientRect().top)}px`;
    }
}

function initializeAuthorGallery() {
    const viewer = document.querySelector('[data-author-gallery-viewer]');
    const items = [...document.querySelectorAll('[data-author-gallery-item]')];
    if (!viewer || !items.length) return;

    const image = viewer.querySelector('[data-gallery-image]');
    const caption = viewer.querySelector('[data-gallery-caption]');
    const previous = viewer.querySelector('[data-gallery-previous]');
    const next = viewer.querySelector('[data-gallery-next]');
    const close = viewer.querySelector('[data-gallery-close]');
    let index = 0;
    let opener;
    let touchStartX;

    const show = (nextIndex) => {
        index = (nextIndex + items.length) % items.length;
        const item = items[index];
        image.src = item.dataset.imageUrl;
        image.alt = item.dataset.imageAlt || 'Photo';
        caption.textContent = item.dataset.imageCaption || '';
        previous.hidden = next.hidden = items.length < 2;
    };
    const open = (nextIndex, trigger) => {
        opener = trigger;
        show(nextIndex);
        viewer.hidden = false;
        document.body.classList.add('has-gallery-viewer');
        close.focus({ preventScroll: true });
    };
    const closeViewer = () => {
        viewer.hidden = true;
        document.body.classList.remove('has-gallery-viewer');
        opener?.focus({ preventScroll: true });
    };

    items.forEach((item, itemIndex) => item.addEventListener('click', (event) => {
        event.preventDefault();
        open(itemIndex, item);
    }));
    previous.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    close.addEventListener('click', closeViewer);
    viewer.addEventListener('click', (event) => { if (event.target === viewer) closeViewer(); });
    viewer.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
    viewer.addEventListener('touchend', (event) => {
        if (touchStartX === undefined) return;
        const distance = event.changedTouches[0].clientX - touchStartX;
        touchStartX = undefined;
        if (Math.abs(distance) > 45) show(index + (distance < 0 ? 1 : -1));
    }, { passive: true });
    document.addEventListener('keydown', (event) => {
        if (viewer.hidden) return;
        if (event.key === 'Escape') closeViewer();
        if (event.key === 'ArrowLeft') show(index - 1);
        if (event.key === 'ArrowRight') show(index + 1);
    });
}

initializeArticleNavigation();
initializeArticleSharing();
initializeKeepReading();
formatCaptionCredits();
alignArticleContextRail();
initializeAuthorGallery();
window.addEventListener('resize', alignArticleContextRail, { passive: true });

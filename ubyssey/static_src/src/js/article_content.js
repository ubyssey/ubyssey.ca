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
    const menu = header.querySelector('#ar-expanded-menu');
    let open = false;
    const setOpen = (next) => {
        open = next;
        button.setAttribute('aria-expanded', String(open));
        menu.hidden = !open;
    };
    button.addEventListener('click', () => setOpen(!open));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && open) { setOpen(false); button.focus(); }
    });
    document.addEventListener('click', (event) => {
        if (open && !header.contains(event.target)) setOpen(false);
    });
    const update = () => {
        if (header.dataset.fullBleed === 'true') return;
        header.classList.toggle('is-compact', window.scrollY > 70);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
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

initializeArticleNavigation();
initializeArticleSharing();
initializeKeepReading();

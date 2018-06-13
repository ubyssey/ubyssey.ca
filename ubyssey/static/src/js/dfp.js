const SIZES = {
    'box': [[300, 250], [336,280], [300, 600], [468, 60]],
    'leaderboard': [[728, 90], [970, 90]],
    'mobile-leaderboard': [300, 50]
};

// Get reference to googletag from window object
const googletag = window.googletag;

class DFP {

  constructor() {
    this.adslots = [];
    this.element = document;
  }

  static setup() {
    // Infinite scroll requires SRA
    googletag.pubads().enableSingleRequest();

    // Disable initial load, we will use refresh() to fetch ads.
    // Calling this function means that display() calls just
    // register the slot as ready, but do not fetch ads for it.
    googletag.pubads().disableInitialLoad();

    // Enable services
    googletag.enableServices();
  }

  collectAds() {
    const dfpslots = $(this.element).find('.adslot').filter(':visible');

    $(dfpslots).each((_, dfpslot) => {
      const slotName = $(dfpslot).attr('id')

      const slot = googletag.defineSlot(
        `/61222807/${$(dfpslot).data('dfp')}`,
        SIZES[$(dfpslot).data('size')],
        slotName
      )
        .setCollapseEmptyDiv(true)
        .addService(googletag.pubads());

      this.adslots.push([slotName, slot]);
    });
  }

  refreshAds() {
    this.adslots.forEach(slot => {
      googletag.display(slot[0]);
      googletag.pubads().refresh([slot[1]]);
    });
  };

  load(element) {
    this.element = element;
    googletag.cmd.push(DFP.setup);
    googletag.cmd.push(this.collectAds.bind(this));
    googletag.cmd.push(this.refreshAds.bind(this));
  }

  reset() {
    this.adslots = [];
    googletag.cmd.push(googletag.destroySlots);
  }

}

const dfp = new DFP();

$(document).ready(function() {
  dfp.load(document);
});

window.resetAds = function(element) {
  dfp.reset();
  dfp.load(element);
}

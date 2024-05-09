// DFP (DoubleClick for Publishers) == Google's advertising service that powers ad delivery across the site
// https://ads-developers.googleblog.com/2018/07/dfp-api-is-becoming-google-ad-manager.html
// DFP now known as Google Ad Manager

// new DFP ad tags are known as GPT (Google Publisher Tags)

const SIZES = {
    'box': [300, 250], 
    'skyscraper' : [[300, 250], [300, 600]],
    'banner': [468, 60],
    'leaderboard': [[728, 90], [970, 90]],
    'mobile-leaderboard': [320, 50]
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
    // grapefruit
    // googletag.pubads().enableSingleRequest();

    // Disable initial load, we will use refresh() to fetch ads.
    // Calling this function means that display() calls just
    // register the slot as ready, but do not fetch ads for it.
    googletag.pubads().disableInitialLoad();

    // Enable services
    googletag.enableServices();
  }

  // Select visible adslots and for any new adslots not already 
  collectAds() {

    // Only select visible adslots
    // find() method returns descendant adslots of the selected element (jQuery)
    // filter() method filters and includes only those that are visible
    const dfpslots = $(this.element).find('.adslot').filter(':visible');

    // For each visible dfpslot
    $(dfpslots).each((_, dfpslot) => {
      // Set slotName to dfpslot ID
      const slotName = $(dfpslot).attr('id')

      // Declares const priorSlotNames as this.adslots
      // NOTE: Reduce function does not appear to change array, const priorSlotNames = this.adslots looks like it should produce the same behaviour
      const priorSlotNames = this.adslots.reduce((acc, val) => acc.concat(val), []) 
      
      // If the slot is not already on the page
      // Sets const slot to a newly constructed ad slot with a given ad unit path and size 
      // and associates it with the ID of a div element on the page that will contain the ad.
      if (!priorSlotNames.includes(slotName)) {
        const slot = googletag.defineSlot(
          `/61222807/${$(dfpslot).data('dfp')}`, // Full ad unit path with the network code and unit code.
                                                 // Number = identifier for Ad Manager network (should it be hard-coded?)
          SIZES[$(dfpslot).data('size')], // Width and height of the added slot
          slotName // ID of the div that will contain this ad unit.
        )
        .setCollapseEmptyDiv(true) // Ad slot will be collapsed after no ads detected available for the slot
        .addService(googletag.pubads());
  
        this.adslots.push([slotName, slot]); // add new adslot to array of adslots
      }
    });
  }

  // For each adslot in array adslots (with object of format [slotName, slot] where slotName is ID),
  // register each slot and render ad for slot.
  // NOTE: this is necessary as initial load is disabled during setup (disableInitialLoad())
  refreshAds() {
    this.adslots.forEach(slot => {
      googletag.display(slot[0]);               // register each slotName (no ad content rendered)
      // googletag.pubads().refresh([slot[1]]);
      googletag.pubads().refresh();             // fetch ad for now-registered slot
    });
  };

  // To the global command queue for asynchronous execution of GPT-related calls, add the following
  // (1) disable initial loading of ads and allowing Google Ad Services (setup)
  // (2) bind arg of collectAds function to values of element
  // (3) bind arg of refreshAds function to values of element
  // For (2) and (3), binding is so that when the functions are later called, the args are set
  load(element) {
    this.element = element;
    googletag.cmd.push(DFP.setup);
    googletag.cmd.push(this.collectAds.bind(this));
    googletag.cmd.push(this.refreshAds.bind(this));
  }

  // Reset adslots to empty array
  // To the global command queue, add command to destroys all slots, removing all related objects and references of those slots from GPT
  reset() {
    this.adslots = [];
    googletag.cmd.push(googletag.destroySlots);
  }
}

// New Google Ad Mananger
const dfp = new DFP();

// To the document, disable inital loading of ads and bind DFP functions to document.
$(document).ready(function() {
  dfp.load(document);
});

// window.resetAds declared as function that resets Google Ad Manager and sets it back up again
window.resetAds = function(element) {
  dfp.reset();
  dfp.load(element);
}

// https://developer.mixpanel.com/docs/what-is-mixpanel

// Track article page visits through Mixpanel
export function pageView(type, article, index) {
  // evt with variables Page Title, URL, Page Type
  let evt = {
    'Page Title': document.title,
    'URL': window.location.pathname,
    'Page Type': type || 'page'
  };
  
  // If pageView function called by article also set evt variables Headline, Author, Section
  if (type === 'article') {
    evt['Headline'] = article.data('headline');
    evt['Author'] = article.data('author');
    evt['Section'] = article.data('section');
  }
  
  // If index != 0, also set evt Scroll Depth
  if (index) {
    evt['Scroll Depth'] = index;
  }
  
  mixpanel.track('Page View', evt); // track
}

// Track article sharing through Mixpanel
export function shareArticle(platform, article) {
  mixpanel.track('Share Article', {
    'Social Platform': platform,
    'Headline': article.data('headline'),
    'Author': article.data('author'),
    'Section': article.data('section')
  });
}

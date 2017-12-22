const DB_KEY = "aggregated-rss";
const AGGREGATE_INTERVAL = 60000;

/**
 * A single item in the rss feed.
 *
 * Only certain fields are used, but for more
 * see {@link https://cyber.harvard.edu/rss/rss.html#ltpubdategtSubelementOfLtitemgt|item} for more fields
 *
 * @typedef {Object} FeedItem
 *
 * @property {String} pubDate - Should be a parsable datetime
 * @property {String} isoDate - Not always present, so fallback to {@see pubDate}
 */

/**
 * @typedef {Object} RssJson
 *
 * @property {Object} feed
 * @property {FeedItem[]} feed.items
 */

/**
 * @typedef {String} UrlString
 */

/**
 * Promisify RSSParser.parseURL
 *
 * @param url
 * @returns {Promise<RssJson, String>} Errors should be simple strings
 */
function parseRSS(url) {
    return new Promise((accept, reject) => {
        RSSParser.parseURL(url, function (err, parsed) {
            if (err) {
                return reject(err)
            } else {
                accept(parsed)
            }
        })
    })

}

/**
 * @typedef {Object.<String, RssJson>} Successes
 *
 * A URL to RSS JSON pairing
 */

/**
 * @typedef {Object} BestEffortError
 *
 * @property {String} url
 * @property {String} error
 */

/**
 * Best effort parse of all given URLS
 *
 * @param urls
 * @returns {Promise<(Successes, BestEffortError[])>}
 */
function parseAllRSS(urls) {

    return new Promise((accept) => {
        let leftToProcess = urls.length;
        let successes = {};
        let errors = [];
        if(urls.length < 1){
            accept(successes, errors);
            return
        }
        Object.keys(urls.reduce((acc, url) => {
            acc[url] = null;
            return acc
        }, {})).map((url) => {
            parseRSS(url)
                .then((parsed) => {
                    successes[url] = parsed;
                    if (--leftToProcess <= 0) {
                        accept(successes, errors)
                    }
                })
                .catch((error) => {
                    errors.push({url, error});
                    if (--leftToProcess <= 0) {
                        accept(successes, errors)
                    }
                });
        })
    })
}

/**
 * @typedef {Object} DbFeedItem
 * @property {Number} datetime - unix time of when the
 * @property {String} feedUrl - where this item was recovered from
 * @property {Boolean} read - whether the item was read by the user
 */

/**
 * @typedef {Object.<UrlString, DbFeedItem>} DbAggregation
 */

/**
 * @param {DbAggregation} old
 * @param {Successes} successes
 */
function mergeOldWithNewItems(old, successes) {
    for (let rssUrl in successes) {

        // Add only truly new items
        // No need to update the old ones (hence the filter)
        for (let item of successes[rssUrl].feed.entries.filter(item => !old[item.link])) {
            let time = Date.parse(item.isoDate || item.pubDate);
            if (isNaN(time)) {
                console.warn(`Couldn't parse time of item in the feed ${rssUrl}`, item)
                continue
            }
            old[item.link] = {
                title: item.title,
                url: item.link,
                description: item.description,
                datetime: time,
                feedUrl: rssUrl,
                read: false,
            }
        }
    }
}

/**
 * Updates the DB with parsed items
 * @param {Successes} successes
 */
function saveToDB(successes) {
    browser.storage.sync.get(DB_KEY).then((aggregatedRSS) => {
        let toSave = aggregatedRSS[DB_KEY] || {};
        mergeOldWithNewItems(toSave, successes);
        browser.storage.sync.set({[DB_KEY]: toSave});
    });
}

browser.browserAction.onClicked.addListener(() => {
    browser.tabs.create({
        url: browser.extension.getURL("src/aggregator.html")
    })
})

function aggregateFeeds() {
    let promise = null;
    browser.bookmarks.search("rss").then((results) => {
        let nonFolders = results.filter(bookmark => bookmark.type === "bookmark");
        let urls = nonFolders.map(bookmark => bookmark.url);
        if (!promise) {
            promise = parseAllRSS(urls)
                .then(saveToDB)
                .then(() => {
                    setTimeout(aggregateFeeds, AGGREGATE_INTERVAL)
                })
        }
    });
}

aggregateFeeds();


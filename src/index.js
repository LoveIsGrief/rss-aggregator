const DB_KEY = "aggregated-rss";

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
 * The import item that will be used in the UI
 * @typedef {Object} DbItemInstance
 *
 * @property {Date} readAt
 * @property {FeedItem} item
 */

/**
 * @typedef {Object.<UrlString, DbItemInstance>} DbInstances
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
 * A URL to RSS JSON pairing
 *
 * @typedef {Object.<String, RssJson>} Successes
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
 * Key is datetime
 * Value is an url to {@see FeedItem} pair
 *
 * @typedef {Object.<Number, Object.<string, FeedItem> >} PrimaryAggregation
 */

/**
 * Get the datetime of each item in each feed and flattens successes
 *
 * @param {Successes} successes
 * @param {BestEffortError[]} errors
 * @returns {PrimaryAggregation}
 */
function aggregateNewItems(successes, errors) {
    return Object.keys(successes).reduce((acc, rssUrl) => {
        let entries = successes[rssUrl].feed.entries;
        for (let item of entries) {
            let time = Date.parse(item.isoDate || item.pubDate);
            if (isNaN(time)) {
                console.warn(`Couldn't parse time of item in the feed ${rssUrl}`, item)
                continue
            }
            var itemsAtTime = acc[time] || {};
            // We add a dict of the item in order to be able to add more properties
            // e.g when it was read, if it's faved, etc.
            itemsAtTime[item.link] = item
            acc[time] = itemsAtTime
        }
        return acc
    }, {})
}

/**
 * TODO Make the value an array sorted by time so that the display won't have to resort
 * Key: datetime
 * @typedef {Object.<Number, Object.<UrlString, DbInstances> >} DbAggregation
 */

/**
 * @param {DbAggregation} old
 * @param {PrimaryAggregation} _new
 */
function mergeOldWithNewItems(old, _new) {
    for (let time in _new) {
        let newItemInstances = _new[time];
        let oldItemInstances = old[time] || {};

        for (var itemUrl in newItemInstances) {
            let newItem = newItemInstances[itemUrl];
            let oldInstance = oldItemInstances[itemUrl] || {};
            oldInstance.item = newItem;
            oldInstance.datetime = time;
            oldItemInstances[itemUrl] = oldInstance;
        }
        old[time] = oldItemInstances;
    }
}

/**
 * Updates the DB with parsed items
 * @param {PrimaryAggregation} newResults
 */
function saveToDB(newResults) {
    browser.storage.sync.get(DB_KEY).then((aggregatedRSS) => {
        let toSave = aggregatedRSS[DB_KEY] || {};
        mergeOldWithNewItems(toSave, newResults);
        browser.storage.sync.set({[DB_KEY]: toSave});
    });
}

browser.browserAction.onClicked.addListener(() => {
    browser.tabs.create({
        url: browser.extension.getURL("src/aggregator.html")
    })
})

parseAllRSS([
    "https://www.reddit.com/.rss",
    "http://science.sciencemag.org/rss/twis.xml",
    "http://rss.cnn.com/rss/edition.rss",
    "http://feeds.bbci.co.uk/news/world/latin_america/rss.xml"
])
    .then(aggregateNewItems)
    .then(saveToDB)

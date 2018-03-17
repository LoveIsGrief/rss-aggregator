const DB_KEY = "aggregated-rss";
const AGGREGATE_INTERVAL = 60000;
const CHECK_INTERVAL = 5000;

/**
 * Checked URLs with when they were checked in unix timestamp milliseconds
 * @type {Object.<String, Number>}
 */
let toCheck = {};

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
        if (urls.length < 1) {
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

let savingToDB = null;

/**
 * Updates the DB with parsed items
 * @param {Successes} successes
 */
function saveToDB(successes) {
    if (savingToDB) {
        return
    }
    browser.storage.sync.get(DB_KEY).then((aggregatedRSS) => {
        let toSave = aggregatedRSS[DB_KEY] || {};
        let countOld = Object.keys(toSave).length;
        mergeOldWithNewItems(toSave, successes);
        let countNew = Object.keys(toSave).length;
        let diff = countNew - countOld;
        savingToDB = browser.storage.sync.set({[DB_KEY]: toSave}).then(() => {
            // For some reason this is called twice? on one set? bug or do I just program like shit?
            if (diff > 0) {
                browser.notifications.create({
                    title: "New feed items",
                    type: "basic",
                    message: `${diff} new feed item(s)`
                })
            }
            savingToDB = null;
        });
    });
}

browser.browserAction.onClicked.addListener(() => {
    // Allowing only one tab
    let url = browser.extension.getURL("src/aggregator.html");
    browser.tabs.query({
        url: `${url}*`
    }).then((tabs) => {
        if (tabs.length > 0) {
            browser.tabs.update(tabs[0].id, {
                active: true
            });
        } else {
            browser.tabs.create({
                url: url
            })
        }
    })
})

function aggregateFeeds() {
    let promise = null;
    browser.bookmarks.search("rss").then((results) => {
        let nonFolders = results.filter(bookmark => bookmark.type === "bookmark");
        let urls = nonFolders.map(bookmark => bookmark.url);

        let now = Date.now();
        let toAggregate = urls.filter((url) => {
            let isOld = url in toCheck;
            let seenNeedsToBeChecked = isOld && (now - toCheck[url]) > AGGREGATE_INTERVAL;
            let ret = !isOld || seenNeedsToBeChecked;
            if (ret) {
                toCheck[url] = now;
            }
            return ret
        });

        if (!promise) {
            promise = parseAllRSS(toAggregate)
                .then(saveToDB)
                .then(() => {
                    setTimeout(aggregateFeeds, CHECK_INTERVAL)
                })
        }
    });
}

aggregateFeeds();


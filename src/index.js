const DB_KEY = "aggregated-rss";
const AGGREGATE_INTERVAL = 60000;
const CHECK_INTERVAL = 5000;
/**
 * Time in days after which an item is kept or even allowed into the DB.
 * @type {number}
 */
const DEFAULT_EXPIRY_DAYS = 7;
const EXPIRY_KEY = "expiry_days";
const DAY_IN_MILLI = 86400000;

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
 * @property {Boolean} starred - do we love this item and wanna keep it around?
 */

/**
 * @typedef {Object.<UrlString, DbFeedItem>} DbAggregation
 */

/**
 * @param {DbAggregation} old
 * @param {Successes} successes
 * @param {Number} expiryDateMs
 */
function mergeOldWithNewItems(old, successes, expiryDateMs) {

    for (let rssUrl in successes) {

        successes[rssUrl].feed.entries
        // Add only truly new items
        // No need to update the old ones (hence the filter)
            .filter(item => !old[item.link])
            // Only items with valid, fresh dates
            .filter((item) => {
                item.time = Date.parse(item.isoDate || item.pubDate);
                return !isNaN(item.time) && !shouldClean(item, expiryDateMs)
            })
            .forEach((item) => {
                old[item.link] = {
                    title: item.title,
                    url: item.link,
                    description: item.description,
                    datetime: item.time,
                    feedUrl: rssUrl,
                    read: false,
                }

            })
    }
}

/**
 * Starred and unexpired items shouldn't be cleaned
 * @param item {DbFeedItem}
 * @param expiryDateMs {Number}
 * @returns {boolean}
 */
function shouldClean(item, expiryDateMs){
    return !item.starred && item.datetime <= expiryDateMs
}

/**
 *
 * @param db {DbFeedItem}
 * @param expiryDateMs {Number}
 */
function cleanExistingItems(db, expiryDateMs) {
    let cleaned = 0;
    Object.keys(db).forEach((url) => {
        if(shouldClean(db[url], expiryDateMs)){
            delete db[url];
            cleaned++;
        }
    })
    if(cleaned){
        console.info(`Cleaned ${cleaned} items`);
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
    Promise.all([
        browser.storage.sync.get(EXPIRY_KEY),
        browser.storage.sync.get(DB_KEY)
    ]).then((values) => {
        const expiryDays = values[0][EXPIRY_KEY] || DEFAULT_EXPIRY_DAYS;
        const expiryDate = Date.now() - (expiryDays * DAY_IN_MILLI);

        let aggregatedRSS = values[1];
        let toSave = aggregatedRSS[DB_KEY] || {};
        cleanExistingItems(toSave, expiryDate);
        const countOld = Object.keys(toSave).length;
        mergeOldWithNewItems(toSave, successes, expiryDate);

        const countNew = Object.keys(toSave).length;
        const diff = countNew - countOld;
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


const DB_KEY = "aggregated-rss";


angular.module("aggregatorApp", []).controller("AggregatorController", [
    "$scope",
    function ($scope) {
        this.dbItems = {};
        this.items = [];
        this.hideRead = false;
        this.newestToOldest = false;

        ["hideRead", "newestToOldest"].forEach((booleanOption) => {
            browser.storage.sync.get(booleanOption).then((res) => {
                let booleanValue = res[booleanOption];
                $scope.$apply(() => {
                    this[booleanOption] = booleanValue;
                })
                $scope.$watch(() => this[booleanOption], () => {
                    browser.storage.sync.set({
                        [booleanOption]: this[booleanOption]
                    })
                })
            })
        });


        setInterval(() => {
            browser.storage.sync.get(DB_KEY).then((aggregated) => {
                $scope.$apply(() => {
                    this.dbItems = aggregated[DB_KEY] || {};
                    this.items = [];
                    for (var url in this.dbItems) {
                        this.items.push(this.dbItems[url]);
                    }
                });
            })
        }, 500)

        this.toggleRead = (item, read) => {
            item.read = read !== undefined ? read : !item.read;
            browser.storage.sync.set({[DB_KEY]: this.dbItems})
        }

        /**
         * Hide read items if the option is activated
         * @param {DbFeedItem} item
         * @returns {boolean}
         */
        this.hideItemFilter = (item) => {
            return !(this.hideRead && item.read)
        }
    }
])
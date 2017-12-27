const DB_KEY = "aggregated-rss";

angular.module("aggregatorApp", []).controller("AggregatorController", [
    "$scope",
    function ($scope) {
        this.dbItems = {};
        this.items = [];
        this.clickToContainPort = browser.runtime.connect("@click-to-contain");

        let booleanOptions = ["hideRead", "newestToOldest", "openInRandomContainer"];

        booleanOptions.forEach((booleanOption) => {
            this[booleanOption] = false;
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

        // Force an update when we can't connect to the port
        this.clickToContainPort.onDisconnect.addListener(() => {
            $scope.$apply(() => {})
        })


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

        this.openItemLink = (item) => {
            if (!this.clickToContainPort.error && this.openInRandomContainer) {
                this.clickToContainPort.postMessage({
                    command: "openTab",
                    data: {
                        url: item.url
                    }
                })
            } else {
                window.open(item.url)
            }
            this.toggleRead(item, true);
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
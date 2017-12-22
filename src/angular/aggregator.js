const DB_KEY = "aggregated-rss";


angular.module("aggregatorApp", [
    "ui.bootstrap"
]).controller("AggregatorController", [
    "$scope",
    function ($scope) {
        this.dbItems = {};
        this.items = [];
        this.hideRead = false;

        browser.storage.sync.get("hideRead").then(({hideRead}) => {
            $scope.$apply(() => {
                this.hideRead = hideRead
            })
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

        this.toggleHideRead = () => {
            this.hideRead = !this.hideRead;
            browser.storage.sync.set({
                hideRead: this.hideRead
            })
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
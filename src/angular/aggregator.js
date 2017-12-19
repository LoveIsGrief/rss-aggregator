const DB_KEY = "aggregated-rss";


angular.module("aggregatorApp", [
    "ui.bootstrap"
]).controller("AggregatorController", [
    "$scope",
    function ($scope) {
        this.dbItems = {};
        this.items = [];

        browser.storage.sync.get(DB_KEY).then((aggregated) => {
            $scope.$apply(() => {
                this.dbItems = aggregated[DB_KEY] || {};
                this.items = [];
                for (var url in this.dbItems) {
                    this.items.push(this.dbItems[url]);
                }
                console.log(this.items)
            });
        })

        this.toggleRead = (item, read) => {
            item.read = read !== undefined ? read : !item.read;
            browser.storage.sync.set({[DB_KEY]: this.dbItems})
        }
    }
])
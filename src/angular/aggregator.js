const DB_KEY = "aggregated-rss";


angular.module("aggregatorApp", [
    "ui.bootstrap"
]).controller("AggregatorController", [
    "$scope",
    function ($scope) {
        this.items = {};

        browser.storage.sync.get(DB_KEY).then((aggregated) => {
            $scope.$apply(() => {
                Object.assign(this.items, aggregated[DB_KEY] || {});
                console.log("applied", this.items);
            });
        })

        this.toggleRead = (instance, read) => {
            instance.read = read !== undefined ? read : !instance.read;
            browser.storage.sync.set({[DB_KEY]: this.items})
        }
    }
])
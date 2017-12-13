const DB_KEY = "aggregated-rss";


angular.module("aggregatorApp", [
    "ui.bootstrap"
]).controller("AggregatorController", [
    "$rootScope",
    function ($rootScope) {
        this.items = {};
        this.activeHover = null;

        browser.storage.sync.get(DB_KEY).then((aggrated) => {
            $rootScope.$apply(()=>{
              this.items = aggrated[DB_KEY] || {};
            });
        })

        this.getDate = (time)=>{
          return new Date(Number.parseInt(time))
        }
    }
])
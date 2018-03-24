function ItemDetail($scope, $element, $attrs) {
    this.getHost = (url) => {
        let host = "Unknown host";
        try {
            host = (new URL(url)).host
        } catch (e) {
            console.debug(`Couldn't get host of ${url}`, e)
        }
        return host
    }
}

angular.module("aggregatorApp").component("itemDetail", {
    templateUrl: "/src/angular/components/itemDetail.html",
    controller: ItemDetail,
    bindings: {
        item: "<",
        onToggleRead: "&",
        onToggleStarred: "&",
        onItemClicked: "&",
    }
})

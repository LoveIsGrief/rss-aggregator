function ItemDetail($scope, $element, $attrs) {
    this.getHost = (url) => {
        return (new URL(url)).host
    }
}

angular.module("aggregatorApp").component("itemDetail", {
    templateUrl: "/src/angular/components/itemDetail.html",
    controller: ItemDetail,
    bindings: {
        item: "<",
        onToggleRead: "&",
        onItemClicked: "&",
    }
})
function ItemDetail($scope, $element, $attrs) {

}

angular.module("aggregatorApp").component("itemDetail", {
    templateUrl: "/src/angular/components/itemDetail.html",
    controller: ItemDetail,
    bindings: {
        datetime: "<",
        instances: "<",
        onToggleRead: "&"
    }
})
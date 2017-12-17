function ItemDetail($scope, $element, $attrs) {

    this.toggleRead = (instance, read) => {
        instance.read = read !== undefined ? read : !instance.read;
    }
}

angular.module("aggregatorApp").component("itemDetail", {
    templateUrl: "/src/angular/components/itemDetail.html",
    controller: ItemDetail,
    bindings: {
        datetime: "<",
        instances: "<"
    }
})
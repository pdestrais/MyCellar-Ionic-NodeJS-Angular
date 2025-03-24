import { Router } from "@angular/router";
import { Component, OnInit, Input } from "@angular/core";
import { addIcons } from "ionicons";
import { star } from "ionicons/icons";

@Component({
    selector: "app-breadcrumb",
    templateUrl: "./breadcrumb.component.html",
    styleUrls: ["./breadcrumb.component.scss"],
    standalone: false
})
export class BreadcrumbComponent implements OnInit {
    @Input() breadcrumb: Array<any> = [];

    constructor(private router: Router) {
        addIcons({ star });
    }

    ngOnInit() { }

    goBack(urlTree) {
        let bc: Array<any> = JSON.parse(sessionStorage.getItem("breadcrumb")!);
        let index = bc.findIndex((el) =>
            this.arrayContainsArray(el.backUrlTree, urlTree)
        );
        bc.splice(index);
        sessionStorage.setItem("breadcrumb", JSON.stringify(bc));
        this.router.navigate(urlTree);
    }

    /**
     * Returns TRUE if the first specified array contains all elements
     * from the second one. FALSE otherwise.
     *
     * @param {array} superset
     * @param {array} subset
     *
     * @returns {boolean}
     */
    arrayContainsArray(superset, subset) {
        if (0 === subset.length) {
            return false;
        }
        return subset.every((value) => superset.indexOf(value) >= 0);
    }
}

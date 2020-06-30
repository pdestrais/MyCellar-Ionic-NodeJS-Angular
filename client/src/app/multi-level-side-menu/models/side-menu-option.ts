// RxJS
import { Observable } from 'rxjs';

// SideMenuOption interface
export interface SideMenuOption {
	// If the option has sub items and the iconName is null,
	// the default icon will be 'ios-arrow-down'.
	iconName?: string;

	// if the icon is not part of the standard available icons but a specific svg file available via an url
	iconSrc?: string;

	// The name to display in the menu
	displayText: string;

	// The badge option expects an Observable that allows
	// the application to dynamically update the value of the badge.
	badge?: Observable<any>;

	// Target component (or null if it's a "special option" like login/logout)
	component?: any;

	// Target route (specified as UrlTree)
	route?: Array<any>;

	// Here you can pass whatever you need, and will be returned if this
	// option is selected. That way you can handle login/logout options,
	// changing the language, and son on...
	custom?: any;

	// Set if this option is selected by default
	selected?: boolean;

	// List of sub items if any
	suboptions?: Array<SideMenuOption>;
}

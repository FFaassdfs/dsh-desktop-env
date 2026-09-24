export namespace main {
	
	export class coreOption {
	    channel: string;
	    version: string;
	    published: string;
	    installed: boolean;
	    skipped: boolean;
	    newer: boolean;
	
	    static createFrom(source: any = {}) {
	        return new coreOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.channel = source["channel"];
	        this.version = source["version"];
	        this.published = source["published"];
	        this.installed = source["installed"];
	        this.skipped = source["skipped"];
	        this.newer = source["newer"];
	    }
	}
	export class coreVersionsView {
	    installed: string;
	    latestTag: string;
	    options: coreOption[];
	    skipped: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new coreVersionsView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.latestTag = source["latestTag"];
	        this.options = this.convertValues(source["options"], coreOption);
	        this.skipped = source["skipped"];
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}


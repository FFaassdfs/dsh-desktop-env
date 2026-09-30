export namespace officialdetect {
	
	export class Install {
	    displayName: string;
	    version: string;
	    publisher: string;
	    dir: string;
	    uninstallString: string;
	    userInstall: boolean;
	    registryKey: string;
	    signatureVerified: boolean;
	    runtimeVersion: string;
	    electronVersion: string;
	
	    static createFrom(source: any = {}) {
	        return new Install(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.displayName = source["displayName"];
	        this.version = source["version"];
	        this.publisher = source["publisher"];
	        this.dir = source["dir"];
	        this.uninstallString = source["uninstallString"];
	        this.userInstall = source["userInstall"];
	        this.registryKey = source["registryKey"];
	        this.signatureVerified = source["signatureVerified"];
	        this.runtimeVersion = source["runtimeVersion"];
	        this.electronVersion = source["electronVersion"];
	    }
	}
	export class State {
	    installed: boolean;
	    installs: Install[];
	    downloadUrl: string;
	    dshHome: string;
	    desktopProfile: string;
	    profileInitialized: boolean;
	    patchFile: string;
	    ourPatchEntries: string[];
	    appPatchEntries: string[];
	    patchReadError?: string;
	    running: boolean;
	    port: number;
	    notes: string[];
	
	    static createFrom(source: any = {}) {
	        return new State(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.installs = this.convertValues(source["installs"], Install);
	        this.downloadUrl = source["downloadUrl"];
	        this.dshHome = source["dshHome"];
	        this.desktopProfile = source["desktopProfile"];
	        this.profileInitialized = source["profileInitialized"];
	        this.patchFile = source["patchFile"];
	        this.ourPatchEntries = source["ourPatchEntries"];
	        this.appPatchEntries = source["appPatchEntries"];
	        this.patchReadError = source["patchReadError"];
	        this.running = source["running"];
	        this.port = source["port"];
	        this.notes = source["notes"];
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


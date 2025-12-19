export namespace board {
	
	export class BoardInfo {
	    Protocol: string;
	    Serial: string;
	    Address: string;
	    CustomName: string;
	    BoardName: string;
	
	    static createFrom(source: any = {}) {
	        return new BoardInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Protocol = source["Protocol"];
	        this.Serial = source["Serial"];
	        this.Address = source["Address"];
	        this.CustomName = source["CustomName"];
	        this.BoardName = source["BoardName"];
	    }
	}
	export class Board {
	    id: string;
	    info: BoardInfo;
	
	    static createFrom(source: any = {}) {
	        return new Board(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.info = this.convertValues(source["info"], BoardInfo);
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
	
	export class KeyboardLayout {
	    label: string;
	    id: string;
	
	    static createFrom(source: any = {}) {
	        return new KeyboardLayout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.id = source["id"];
	    }
	}

}

export namespace fs {
	
	export class FSNode {
	    name: string;
	    path: string;
	    size: number;
	    isDir: boolean;
	    createdAt?: string;
	    modifiedAt?: string;
	    extension?: string;
	    mimeType?: string;
	    children?: FSNode[];
	
	    static createFrom(source: any = {}) {
	        return new FSNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.isDir = source["isDir"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	        this.extension = source["extension"];
	        this.mimeType = source["mimeType"];
	        this.children = this.convertValues(source["children"], FSNode);
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

export namespace learn {
	
	export class Tag {
	    id: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new Tag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	    }
	}
	export class FullLearnResource {
	    id: string;
	    title: string;
	    description: string;
	    tags: Tag[];
	    icon: string;
	    category: string;
	    // Go type: time
	    lastRevision?: any;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new FullLearnResource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.tags = this.convertValues(source["tags"], Tag);
	        this.icon = source["icon"];
	        this.category = source["category"];
	        this.lastRevision = this.convertValues(source["lastRevision"], null);
	        this.content = source["content"];
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
	export class LearnResourceEntry {
	    id: string;
	    title: string;
	    description: string;
	    tags: Tag[];
	    icon: string;
	    category: string;
	    // Go type: time
	    lastRevision?: any;
	
	    static createFrom(source: any = {}) {
	        return new LearnResourceEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.tags = this.convertValues(source["tags"], Tag);
	        this.icon = source["icon"];
	        this.category = source["category"];
	        this.lastRevision = this.convertValues(source["lastRevision"], null);
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


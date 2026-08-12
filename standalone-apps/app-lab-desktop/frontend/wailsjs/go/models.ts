export namespace agent {
	
	export class AgentMode {
	    id: string;
	    name: string;
	    description?: string;
	
	    static createFrom(source: any = {}) {
	        return new AgentMode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class AgentModel {
	    id: string;
	    name: string;
	    description?: string;
	
	    static createFrom(source: any = {}) {
	        return new AgentModel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class AuthMethod {
	    id: string;
	    name: string;
	    description?: string;
	    type?: string;
	    args?: string[];
	
	    static createFrom(source: any = {}) {
	        return new AuthMethod(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.type = source["type"];
	        this.args = source["args"];
	    }
	}
	export class AuthStatus {
	    authenticated: boolean;
	    agentId?: string;
	    isDefault?: boolean;
	    method?: string;
	    account?: string;
	    connectedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new AuthStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.authenticated = source["authenticated"];
	        this.agentId = source["agentId"];
	        this.isDefault = source["isDefault"];
	        this.method = source["method"];
	        this.account = source["account"];
	        this.connectedAt = source["connectedAt"];
	    }
	}
	export class ChoiceSubmission {
	    selectedIds: string[];
	    other?: string;
	    cancelled?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ChoiceSubmission(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.selectedIds = source["selectedIds"];
	        this.other = source["other"];
	        this.cancelled = source["cancelled"];
	    }
	}
	export class PermissionOption {
	    id: string;
	    label: string;
	    kind: string;
	
	    static createFrom(source: any = {}) {
	        return new PermissionOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.kind = source["kind"];
	    }
	}
	export class PermissionOutcome {
	    optionId?: string;
	    cancelled?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PermissionOutcome(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.optionId = source["optionId"];
	        this.cancelled = source["cancelled"];
	    }
	}
	export class ToolCall {
	    id: string;
	    title: string;
	    kind?: string;
	    status: string;
	    input?: any;
	    output?: string;
	
	    static createFrom(source: any = {}) {
	        return new ToolCall(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.kind = source["kind"];
	        this.status = source["status"];
	        this.input = source["input"];
	        this.output = source["output"];
	    }
	}
	export class PermissionRequest {
	    id: string;
	    sessionId: string;
	    toolCall?: ToolCall;
	    options: PermissionOption[];
	    timeoutMs?: number;
	
	    static createFrom(source: any = {}) {
	        return new PermissionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sessionId = source["sessionId"];
	        this.toolCall = this.convertValues(source["toolCall"], ToolCall);
	        this.options = this.convertValues(source["options"], PermissionOption);
	        this.timeoutMs = source["timeoutMs"];
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
	export class SessionState {
	    sessionId: string;
	    status: string;
	    modelId?: string;
	    models?: AgentModel[];
	    modeId?: string;
	    modes?: AgentMode[];
	    pendingPermission?: PermissionRequest;
	
	    static createFrom(source: any = {}) {
	        return new SessionState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.status = source["status"];
	        this.modelId = source["modelId"];
	        this.models = this.convertValues(source["models"], AgentModel);
	        this.modeId = source["modeId"];
	        this.modes = this.convertValues(source["modes"], AgentMode);
	        this.pendingPermission = this.convertValues(source["pendingPermission"], PermissionRequest);
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
	export class SessionSummary {
	    id: string;
	    title?: string;
	    updatedAt?: string;
	    status?: string;
	    pinned?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SessionSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.updatedAt = source["updatedAt"];
	        this.status = source["status"];
	        this.pinned = source["pinned"];
	    }
	}

}

export namespace airuntime {
	
	export class Status {
	    installed: boolean;
	    version?: string;
	    diskUsageBytes?: number;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.version = source["version"];
	        this.diskUsageBytes = source["diskUsageBytes"];
	    }
	}
	export class UpdateCheck {
	    updateAvailable: boolean;
	    latestVersion?: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateCheck(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.updateAvailable = source["updateAvailable"];
	        this.latestVersion = source["latestVersion"];
	    }
	}

}

export namespace app {
	
	export class AgentFileLocation {
	    appId: string;
	    file: string;
	
	    static createFrom(source: any = {}) {
	        return new AgentFileLocation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appId = source["appId"];
	        this.file = source["file"];
	    }
	}

}

export namespace board {
	
	export class BoardInfo {
	    FQBN: string;
	    BoardName: string;
	    Protocol: string;
	    Serial: string;
	    Address: string;
	    CustomName: string;
	
	    static createFrom(source: any = {}) {
	        return new BoardInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.FQBN = source["FQBN"];
	        this.BoardName = source["BoardName"];
	        this.Protocol = source["Protocol"];
	        this.Serial = source["Serial"];
	        this.Address = source["Address"];
	        this.CustomName = source["CustomName"];
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

export namespace carrier {
	
	export class DeviceResult {
	    name: string;
	    device_type: string;
	    available_devices: string[];
	
	    static createFrom(source: any = {}) {
	        return new DeviceResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.device_type = source["device_type"];
	        this.available_devices = source["available_devices"];
	    }
	}
	export class Carrier {
	    name: string;
	    devices: DeviceResult[];
	
	    static createFrom(source: any = {}) {
	        return new Carrier(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.devices = this.convertValues(source["devices"], DeviceResult);
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
	
	export class EnableDeviceConfig {
	    Device: string;
	    Option: string;
	
	    static createFrom(source: any = {}) {
	        return new EnableDeviceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Device = source["Device"];
	        this.Option = source["Option"];
	    }
	}
	export class StatusDeviceResult {
	    device: string;
	    option: string;
	    device_type: string;
	
	    static createFrom(source: any = {}) {
	        return new StatusDeviceResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.device = source["device"];
	        this.option = source["option"];
	        this.device_type = source["device_type"];
	    }
	}
	export class ShowCarrierResult {
	    carrier_name: string;
	    current_enabled: boolean;
	    next_enabled: boolean;
	    current: StatusDeviceResult[];
	    next: StatusDeviceResult[];
	
	    static createFrom(source: any = {}) {
	        return new ShowCarrierResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.carrier_name = source["carrier_name"];
	        this.current_enabled = source["current_enabled"];
	        this.next_enabled = source["next_enabled"];
	        this.current = this.convertValues(source["current"], StatusDeviceResult);
	        this.next = this.convertValues(source["next"], StatusDeviceResult);
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
	export class ShowResult {
	    carriers: ShowCarrierResult[];
	
	    static createFrom(source: any = {}) {
	        return new ShowResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.carriers = this.convertValues(source["carriers"], ShowCarrierResult);
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

export namespace flasher {
	
	export class OSImageRelease {
	    VersionLabel: string;
	    ID: string;
	    Latest: boolean;
	
	    static createFrom(source: any = {}) {
	        return new OSImageRelease(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.VersionLabel = source["VersionLabel"];
	        this.ID = source["ID"];
	        this.Latest = source["Latest"];
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

export namespace httpclient {
	
	export class Response {
	    statusCode: number;
	    body: string;
	    headers: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new Response(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.statusCode = source["statusCode"];
	        this.body = source["body"];
	        this.headers = source["headers"];
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

export namespace options {
	
	export class SecondInstanceData {
	    Args: string[];
	    WorkingDirectory: string;
	
	    static createFrom(source: any = {}) {
	        return new SecondInstanceData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Args = source["Args"];
	        this.WorkingDirectory = source["WorkingDirectory"];
	    }
	}

}


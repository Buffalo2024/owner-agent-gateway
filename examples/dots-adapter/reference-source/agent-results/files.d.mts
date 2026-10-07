export const MAX_FILE_BYTES:number;
export const MIME_TYPES:string[];
export function checkBytes(data:Buffer,mime:string):void;
export function requiredKinds(outputs?:string[]):string[];
export function assertDelivery(outputs:string[],files:FileDescriptor[],text?:string):void;
export type FileDescriptor={artifactId:string;fileName:string;mimeType:string;sizeBytes:number;sha256:string};
export class ResultFiles {
 constructor(root:string);
 put(scope:string,data:Buffer,metadata:{fileName:string;mimeType:string}):Promise<FileDescriptor>;
 get(scope:string,id:string):Promise<{descriptor:FileDescriptor;data:Buffer}>;
 descriptors(scope:string,ids:string[]):Promise<FileDescriptor[]>;
}

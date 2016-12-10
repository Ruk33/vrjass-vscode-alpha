export interface Request {
    getData(): any;
}

export class EditRequest implements Request {
    public constructor(
        private uri: string, 
        private code: string
    ) {}

    public getData(): any {
        return {
            type: 'edit',
            data: {
                uri: this.uri,
                content: this.code
            }
        }
    }
}
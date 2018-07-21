import {IHandlerOptions, IOptions} from "./IOptions";
import {Client} from "./client";
import {Job} from "./job";
import {QueueDefaults} from "./defaults";
import {JobsManager} from "./jobsManager";
import {Events} from "./events";
import _ = require("lodash");

export class Queue {

    private _client: Client;
    private _jobsManager: JobsManager;


    constructor(private _options: IOptions) {


        this._options = _.defaults({}, _options, QueueDefaults);

        this._client = new Client(this._options);

        this._jobsManager = new JobsManager(this._options, this._client);

        this._jobsManager.fireEvent("ready");
    }

    public async initialize(): Promise<void> {
        await this._client.connect();

        this._jobsManager.initialize();

    }

    public stop() {
        this._jobsManager.stop();
    }


    public handle(id: string, handler: (job: Job) => any, options?: IHandlerOptions): this {
        this._jobsManager.setJobHandler(id, handler, options);
        return this
    }


    public create(id: string, params?: { [index: string]: any }): Job {
        return this._jobsManager.createJob({id, params});
    }

    public async run(jobId: string,waitForResult: boolean = false): Promise<this | any> {

        let job = await this.getJob(jobId);

        return job.run(waitForResult);
    }


    public async getJob(id: string): Promise<Job> {
        return this._jobsManager.getJob(id)
    }

    public async getAllJobs(): Promise<Job[]> {
        return this._jobsManager.getAllJobs()
    }

    public hasJob(id: string): Promise<boolean> {
        return this._client.hasJob(id)
    }

    public on(event: Events.JobComplete | Events.JobSuccess | Events.JobFail | Events.JobStart  | Events.Error | Events.Ready, fn: (...args: any[]) => any, scope?: any): this {
        this._jobsManager.on(event, fn, scope);
        return this;
    }

    public once(event: Events.JobComplete | Events.JobSuccess | Events.JobFail | Events.JobStart | Events.JobStart | Events.Error | Events.Ready, fn: (...args: any[]) => any, scope?: any): this {
        this._jobsManager.once(event, fn, scope);
        return this;
    }

    public un(event: Events.JobComplete | Events.JobSuccess | Events.JobFail | Events.JobStart | Events.JobStart | Events.Error | Events.Ready, fn: (...args: any[]) => any, scope?: any): this {
        this._jobsManager.un(event, fn, scope);

        return this;
    }

    public async purge() {
        await this._client.purge();
    }

    public async reset() {
        this._jobsManager.reset();
        await this.purge();
        await this._client.quit();
        this.stop();

    }


}
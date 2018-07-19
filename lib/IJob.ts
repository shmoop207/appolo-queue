import {IJobOptions} from "./IOptions";

export interface IJobParams {
    id: string,
    params: { [index: string]: any },
    options: IJobOptions,
    data?: IJobData
}

export interface IJobData {
    lastRun: number;
    runCount: number;
    errorCount:number;
}
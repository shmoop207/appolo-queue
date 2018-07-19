import {IOptions} from "./IOptions";
import {IJobData} from "./IJob";

export  let QueueDefaults = <Partial<IOptions>>{
    checkInterval: 1000,
    lockLifetime: 1000 * 60,
    queueName: 'appolo-queue',
    maxConcurrency: 1

};

export let JobDefaults = <Partial<IJobData>>{
    retry: 10,
    repeat: 0
};
export interface IOptions {
    redis: string
    queueName?: string
    checkInterval?: number
    maxConcurrency?: number
    lockLifetime?: number

}

export type ScheduleType = string | number | Date;

export interface IJobOptions {
    lockLifetime?: number
    schedule?: ScheduleType,
    //delay?: number
    retry?: number
    repeat?: number
    override?: boolean
    handler?:string

}
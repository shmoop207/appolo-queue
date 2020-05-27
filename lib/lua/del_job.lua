local id = ARGV[1]
local queueSet = KEYS[1]
local queueHash = KEYS[2]
local queueSetRunning = KEYS[3]

redis.call('ZREM', queueSet,id)
redis.call('ZREM', queueSetRunning,id)
redis.call('HDEL', queueHash,id)

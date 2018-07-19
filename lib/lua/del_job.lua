local id = ARGV[1]
local queueSet = KEYS[1]
local queueHash = KEYS[2]

redis.call('ZREM', queueSet,id)
redis.call('HDEL', queueHash,id)
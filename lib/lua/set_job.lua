local time = tonumber(ARGV[1])
local id = ARGV[2]
local data = ARGV[3]
local queueSet = KEYS[1]
local queueHash = KEYS[2]

redis.call('ZADD', queueSet, time,id)
redis.call('HSET', queueHash,id,data)

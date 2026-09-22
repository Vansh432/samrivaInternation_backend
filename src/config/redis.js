import Redis from 'ioredis'
import { env } from './env'

const redis=new Redis({
    host:env.redis.host,
    port:env.redis.port,
    password:env.redis.password,
    db:env.redis.db
})

redis.on('connect',()=>{
    console.log("Redis connected successfull");
})

redis.on("ready",()=>{
    console.log("Redis ready for operations")
})

redis.on('error',(err)=>{
    console.log("Redis through the  errors ",err)
})

redis.on('reconnecting',()=>{
    console.log("Redis reconnecting ....")
})

export default redis
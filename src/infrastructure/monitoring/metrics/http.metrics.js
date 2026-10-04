import {Counter} from '@prometheus-io/client'
import {registry} from '../index.js'

const httpRequestTotal=new Counter({
    name:'http_requests_total',
    help:'Total HTTP Request',
    labelNames:["method","route","status"],
    registers:[registry]
})
export {httpRequestTotal};
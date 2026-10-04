import { httpRequestTotal } from "../infrastructure/monitoring/metrics/http.metrics.js"


export const httpRequestCount=(req,res,next)=>{
    // count request and matrix
    res.on('finish',()=>{
       httpRequestTotal.inc({
          method:req?.method,
          route:req?.route?.path,
          status:res.statusCode,
       })
    })
    next();
}
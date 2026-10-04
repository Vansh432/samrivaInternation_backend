import { Router } from "express";
import {registry} from './index.js'

const route=Router();

route.get('/metrics',async(req,res)=>{
    
    res.set('Content-Type',registry.contentType);
    res.end(await registry.metrics());
})

export default route;
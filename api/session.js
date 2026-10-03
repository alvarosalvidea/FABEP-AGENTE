import {clearCookie} from "../lib/session.js";
export default function handler(req,res){
 if(req.method!=="DELETE")return res.status(405).json({error:"Método no permitido"});
 clearCookie(res);
 res.setHeader("Cache-Control","no-store");
 return res.status(200).json({ok:true});
}

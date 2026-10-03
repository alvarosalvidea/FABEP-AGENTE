import crypto from 'node:crypto';
const COOKIE='fabep_session';
function key(){return crypto.createHash('sha256').update(`fabep-session-v1:${process.env.OPENAI_API_KEY||''}`).digest()}
function sign(value){return crypto.createHmac('sha256',key()).update(value).digest('base64url')}
export function encodeSession(conversationId){return `${conversationId}.${sign(conversationId)}`}
export function decodeSession(raw){if(!raw)return null;const i=raw.lastIndexOf('.');if(i<1)return null;const id=raw.slice(0,i),sig=raw.slice(i+1);if(!/^conv_[A-Za-z0-9_-]+$/.test(id))return null;const expected=sign(id);try{const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;return id}catch{return null}}
export function readCookie(req){const raw=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`));return raw?decodeSession(decodeURIComponent(raw.slice(COOKIE.length+1))):null}
export function setCookie(res,conversationId){const secure=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(encodeSession(conversationId))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`)}
export function clearCookie(res){const secure=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)}

// Optional WeChat transport; credential delivery belongs to the host application.
// Call from a server-authorized app session. Never embed shared owner/executor tokens.
function createMiniappClient({wx,baseUrl,getCallerToken}){
 if(!/^https:\/\//.test(baseUrl))throw Error('HTTPS_REQUIRED');
 async function request(path,method,data,key){const token=await getCallerToken();return new Promise((resolve,reject)=>wx.request({url:baseUrl.replace(/\/$/,'')+path,method,data,header:{authorization:'Bearer '+token,'content-type':'application/json',...(key?{'idempotency-key':key}:{})},success:r=>r.statusCode>=200&&r.statusCode<300?resolve(r.data):reject(Error(r.data?.error||'REQUEST_FAILED')),fail:reject}))}
 return {agents:()=>request('/v1/agents','GET'),submit:(task,key)=>{if(!key)throw Error('IDEMPOTENCY_KEY_REQUIRED');return request('/v1/tasks','POST',task,key)},get:id=>request('/v1/tasks/'+encodeURIComponent(id),'GET'),cancel:id=>request('/v1/tasks/'+encodeURIComponent(id),'DELETE')};
}
module.exports={createMiniappClient};

#!/usr/bin/env python3
"""One bounded authenticated request. Input JSON on stdin; never logs token.
Vault injection must be supported by the host; do not paste secrets in chat.
"""
import json, sys, time, urllib.request, urllib.parse, urllib.error
from pathlib import Path
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError("REDIRECT_REJECTED")
def request(v):
    base=v["url"].rstrip("/")
    u=urllib.parse.urlsplit(base)
    if u.scheme!="https" and not (u.scheme=="http" and u.hostname in ("127.0.0.1","localhost","::1")):
        raise ValueError("HTTPS_REQUIRED")
    if u.username or u.password or u.query or u.fragment: raise ValueError("INVALID_URL")
    provider=v.get("provider")
    token=v.get("token")
    if provider:
        if token is not None or u.scheme!="https" or not isinstance(provider,str) or not provider.startswith("custom."):
            raise ValueError("INVALID_PROVIDER")
    elif not isinstance(token,str) or not 32<=len(token)<=1024 or any(c.isspace() for c in token):
        raise ValueError("INVALID_TOKEN")
    action=v["action"]
    if action=="upload-file":
        a=v["assignment"];path="/v1/executor/tasks/"+urllib.parse.quote(a["taskId"],safe="")+"/files"
        body=None
    elif action=="claim":
        path="/v1/executor/claim"; body={"claimRequestId":v["claimRequestId"]}
    elif action in ("heartbeat","result"):
        a=v["assignment"]
        path="/v1/executor/tasks/"+urllib.parse.quote(a["taskId"],safe="")+"/"+action
        body={"attempt":a["attempt"],"leaseId":a["leaseId"]}
        if action=="result":
            body["submissionId"]=v["submissionId"]
            if ("error" in v)==("result" in v): raise ValueError("INVALID_COMPLETION")
            body.update({"error":v["error"]} if "error" in v else {"result":v["result"]})
            if "result" in body and "files" in body["result"]:
                body["result"]={**body["result"],"taskId":a["taskId"],"inputHash":a["inputHash"]}
    else: raise ValueError("INVALID_ACTION")
    if action=="upload-file":
        path_to_file=Path(v["filePath"])
        if not path_to_file.is_file(): raise ValueError("INVALID_FILE")
        with path_to_file.open("rb") as f: data=f.read(10*1024*1024+1)
        if not data: raise ValueError("EMPTY_FILE")
    else: data=json.dumps(body).encode()
    if len(data)>(10*1024*1024 if action=="upload-file" else 131072): raise ValueError("BODY_TOO_LARGE")
    req=urllib.request.Request(base+path,data=data,method="POST",headers={"Content-Type":"application/json"})
    if action=="upload-file":
        req.add_header("Content-Type",v["mimeType"]);req.add_header("x-file-name",urllib.parse.quote(v.get("fileName",Path(v["filePath"]).name),safe=""));req.add_header("x-task-attempt",str(a["attempt"]));req.add_header("x-task-lease",a["leaseId"])
    if provider:
        # Host-owned module; never read or expose a stored credential value.
        sys.path.insert(0,"/opt/hatch/skills/skill-creator/bin")
        from dynamic_credentials import add_surrogate_to_request
        add_surrogate_to_request(req,provider,allowed_hosts=[u.hostname])
    else:
        req.add_header("Authorization","Bearer "+token)
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=60 if action=="upload-file" else 15) as response:
        raw=response.read(262145)
        if len(raw)>262144: raise ValueError("RESPONSE_TOO_LARGE")
        return json.loads(raw)
def main():
    try:
        raw=sys.stdin.buffer.read(262145)
        if len(raw)>262144: raise ValueError("INPUT_TOO_LARGE")
        v=json.loads(raw)
        if v.get("action")=="heartbeat-loop":
            a=v["assignment"]
            deadline=a["attemptDeadline"]/1000
            expires=a["leaseExpiresAt"]/1000
            while time.time()<deadline:
                if time.time()>=expires: raise ValueError("LEASE_EXPIRED")
                renewed=request({**v,"action":"heartbeat"})
                if renewed.get("cancelRequested"): raise ValueError("CANCELLED")
                expires=renewed["leaseExpiresAt"]/1000
                time.sleep(max(0.05,min(3,(expires-time.time())/3,max(0,deadline-time.time()))))
            print(json.dumps({"stopped":"attempt_deadline"}))
        else:
            print(json.dumps(request(v)))
    except urllib.error.HTTPError as e:
        print(json.dumps({"error":"HTTP_REJECTED","status":e.code})); return 1
    except Exception:
        print(json.dumps({"error":"REQUEST_FAILED"})); return 1
    return 0
if __name__=="__main__": sys.exit(main())

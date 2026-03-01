# ASUS Merlin Router Authentication Research

## Login Flow

### Step 1: POST to /login.cgi
```
POST /login.cgi HTTP/1.1
Host: <ROUTER_IP>
Accept: */*
Authorization: Basic <AUTHKEY>
User-Agent: asusrouter-Android-DUTUtil-1.0.0.201
Content-Type: application/x-www-form-urlencoded

login_authorization=<AUTHKEY>
```

Where `<AUTHKEY>` = Base64(`username:password`)

### Step 2: Response with asus_token
```
HTTP/1.0 200 OK
Model_Name: RT-AC66U_B1
Content-Type: application/json:charset=UTF-8
Set-cookie: asus_token=<TOKEN>; HttpOnly;

{ "asus_token": "<TOKEN>" }
```

### Step 3: Use token for all subsequent requests
All subsequent requests must include:
- Header: `cookie: asus_token=<TOKEN>`
- Header: `User-Agent: asusrouter-Android-DUTUtil-1.0.0.245`

### Key Details
- The User-Agent MUST be the specific Android app user-agent string
- Without the correct User-Agent, the router returns an HTML redirect to Main_Login.asp
- The token is returned both as a Set-Cookie header AND in the JSON response body
- Token must be sent as a cookie in all subsequent requests

## Fetching Data with Token

### Example: appGet.cgi hooks
```
POST /appGet.cgi HTTP/1.1
Host: <ROUTER_IP>
User-Agent: asusrouter-Android-DUTUtil-1.0.0.245
cookie: asus_token=<TOKEN>
Content-Type: application/x-www-form-urlencoded

hook=uptime();
```

### Available hooks
- uptime()
- memory_usage()
- cpu_usage()
- get_clientlist()
- netdev(appobj)
- wanlink()
- nvram_get(...)
- dhcpLeaseMacList()

## For Skynet Glass

### Fetching stats.js
GET /user/skynet/stats.js with cookie: asus_token=<TOKEN>

### Sending commands (start_apply.htm)
POST /start_apply.htm with cookie: asus_token=<TOKEN>

### Session Management
- Token can expire — need to detect 401/redirect and re-login
- Router may reject if another user is logged in ("Cannot Login Unless Logout Another User First")
- Should cache token and reuse until it expires

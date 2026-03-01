# SSH Migration Audit

## HTTP Functions → SSH Replacements

| Function | Current HTTP Method | SSH Replacement |
|---|---|---|
| `fetchStatsFromRouter()` | GET `{url}/user/skynet/stats.js` | `cat /tmp/var/wwwext/skynet/stats.js` |
| `triggerRouterGenstats()` | POST `/start_apply.htm` action_script=start_SkynetStats | `/jffs/scripts/firewall stats` |
| `executeRouterCommand(cmd)` | POST `/apply.cgi` SystemCmd=cmd | Run cmd directly via SSH |
| `banIP(ip)` | via executeRouterCommand | `/jffs/scripts/firewall ban ip X "comment"` |
| `unbanIP(ip)` | via executeRouterCommand | `/jffs/scripts/firewall unban ip X` |
| `banRange(cidr)` | via executeRouterCommand | `/jffs/scripts/firewall ban range X "comment"` |
| `unbanRange(cidr)` | via executeRouterCommand | `/jffs/scripts/firewall unban range X` |
| `whitelistIP(ip)` | via executeRouterCommand | `/jffs/scripts/firewall whitelist ip X "comment"` |
| `removeWhitelistIP(ip)` | via executeRouterCommand | `/jffs/scripts/firewall whitelist remove entry ip X` |
| `whitelistDomain(d)` | via executeRouterCommand | `/jffs/scripts/firewall whitelist domain X "comment"` |
| `removeWhitelistDomain(d)` | via executeRouterCommand | `/jffs/scripts/firewall whitelist remove domain X` |
| `refreshWhitelist()` | via executeRouterCommand | `/jffs/scripts/firewall whitelist refresh` |
| `fetchSyslog()` | POST `/apply.cgi` + GET `/cmdRet_check.htm` | `grep "BLOCKED" /tmp/syslog.log ... \| tail -500` |
| `fetchIpsetData()` | POST `/apply.cgi` + GET `/cmdRet_check.htm` | `cat /opt/share/skynet/skynet.ipset` or `ipset save X` |
| `fetchDnsmasqLog()` | POST `/apply.cgi` + GET `/cmdRet_check.htm` | `tail -n 500 /opt/var/log/dnsmasq.log` |
| `fetchDhcpLeases()` | POST `/apply.cgi` + GET `/cmdRet_check.htm` | `cat /var/lib/misc/dnsmasq.leases` |
| `iotBanDevice(ip)` | via executeRouterCommand | `/jffs/scripts/firewall iot ban X` |
| `iotUnbanDevice(ip)` | via executeRouterCommand | `/jffs/scripts/firewall iot unban X` |
| `iotSetPorts(ports)` | via executeRouterCommand | `/jffs/scripts/firewall iot ports X` |
| `iotSetProto(proto)` | via executeRouterCommand | `/jffs/scripts/firewall iot proto X` |
| `testConnection` (routers.ts) | GET stats.js URL | SSH connect + `cat /tmp/var/wwwext/skynet/stats.js \| head -5` |

## Settings Fields to Update

### Remove
- `routerProtocol` (http/https) — not needed
- `routerPort` (80/443) — replaced by sshPort
- `statsPath` (/user/skynet/stats.js) — hardcoded to filesystem path

### Add
- `sshPort` (default 22)

### Keep
- `routerAddress` (IP)
- `username`
- `password`
- `pollingEnabled`
- `pollingInterval`

## Key Benefits
- No session token management
- No login.cgi auth dance
- No cmdRet_check.htm polling (direct command output)
- More reliable — SSH doesn't have the "one user at a time" web GUI limitation
- Faster — no 2-step POST+GET for every command

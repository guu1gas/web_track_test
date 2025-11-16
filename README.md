
# Web Tracking POC — Technical Documentation (Flexible Version)

## 1. Overview
This Proof of Concept (POC) aims to validate a lightweight, flexible mechanism to capture user activity on the Prata Riverside Village website and forward it securely to a backend that will later integrate with Salesforce.

The POC introduces:
- A JavaScript tracking snippet loadable via CDN (e.g., jsDelivr).
- A backend endpoint that receives tracking events.
- A cookie‑based identification strategy (no login dependency).
- Built‑in consent handling.
- Full flexibility for future changes in events, cookie formats, and endpoints.

No URLs, domains, or infrastructure are hardcoded in this documentation. All references are abstract to allow future deployment on the client’s infrastructure (e.g., Heroku, company server, or alternative hosting).

---

## 2. Goals of the POC
1. Validate the feasibility of tracking browser events and forwarding them to a backend.  
2. Confirm that cookies can be used as a more reliable identifier than IP addresses.  
3. Test dynamic loading of account/user identifiers via cookies.  
4. Validate consent‑based filtering (i.e., events are only logged after cookies are accepted).  
5. Demonstrate end‑to‑end flow: browser → backend → storage/logging.  
6. Prepare ground for later Salesforce integration (not part of this POC).

---

## 3. What the POC Does *Not* Decide Yet
- Final event list to capture (only PageView is used for POC).
- Final backend URL/domain (depends on client infrastructure).
- Final cookie format used by the real website.
- Login‑based tracking (removed intentionally).
- Production hosting (server is currently local for POC demonstration).

This ensures the deliverable remains 100% adaptable once the client shares their real requirements.

---

## 4. Technical Architecture (Flexible)
### 4.1 Browser Layer (Tracking Snippet)
Functions:
- Loads automatically on the website.
- Reads cookies (IDs and consent).
- Generates events (“PageView” for POC).
- Only sends data if consent is granted.
- Retries failed network attempts.
- Logs technical messages for debugging.

Inputs:
- User/account cookies (names configurable).
- User consent cookie.
- Event data (dynamic, to be defined in the real project).

Outputs:
- HTTP POST request `{ eventName, timestamp, url, identifiers, eventData }`.

### 4.2 Backend Layer (FastAPI example)
Responsibilities:
- Receive events via `/event`.
- Log them into a rotating file store (or any final DB/Salesforce integration).
- Receive console/debug logs via `/js-log`.
- Keep CORS flexible for future domain changes.

The backend is abstract and can:
- Be deployed on Heroku (recommended for HTTPS).
- Be deployed on internal VIC or ImproveByTech servers.
- Later connect to Salesforce.

---

## 5. Identification Strategy (POC Scope)
Cookies are preferred over IP because:
- IP is shared in offices/hotels.
- IP changes on mobile networks.
- IP cannot reliably identify one person.

The script supports:
- User ID cookie
- Account/email cookie
- Consent cookie (critical)

The format is fully configurable and will adapt once the client shares detail about their cookie structure.

---

## 6. Consent Management
Nothing is tracked until:
- The user accepts cookies **AND**
- The consent cookie exists.

The script:
- Checks consent on load.
- Does not send logs/events before consent.
- Automatically resumes queue after consent is granted.

---

## 7. Event Tracking Model
The POC sends:

### **Event: PageView**
```
{
  "eventName": "PageView",
  "timestamp": "...",
  "url": "...",
  "account": "...",
  "userId": "...",
  "email": "...",
  "cookie_user_id": "...",
  "cookie_consent_status": "granted"
}
```

Future events (to be defined by VIC):
- Clicks
- Scroll depth
- Lead form opened/submitted
- Property detail loaded
- Search filters applied
- Add‑to‑wishlist
- Language change
- Exit intent

These are intentionally omitted until the client's IT team defines the scope.

---

## 8. Deployment Strategy (Flexible)
Because the POC server is HTTP (not HTTPS), browsers will block tracking requests on HTTPS websites.

### Recommended Solution
Deploy the backend on:
- **Heroku** (supports HTTPS for free/cheap)
- **Vercel**
- **Netlify Functions**
- **Railway.app**
- Or VIC’s own HTTPS infrastructure.

This avoids ngrok dependency and gives a stable environment.

---

## 9. Next Steps for the Client
To move forward, the client must define:
1. What events they want to track.
2. The cookie structure of their websites.
3. Whether they have an HTTPS‑capable hosting environment (Heroku or equivalent).
4. Whether events should be stored only or also linked to Salesforce records.

Once this is received, the tracking snippet will be finalized and versioned on jsDelivr.

---

## 10. POC Status and Limitations
This POC:
- Works with any future endpoint URL.
- Does not depend on login.
- Handles consent correctly.
- Is fully modular and upgradable.
- Requires HTTPS to be fully functional on a real website.

Current limitation:
- Hosted locally → requires ngrok → dependent on developer machine uptime.
- No final event list.
- No guarantee cookie names match client’s real site.

---

## 11. Conclusion
The POC validates the feasibility of:
- Browser → endpoint → logging pipeline  
- Consent‑aware user tracking  
- Cookie‑based identification  
- CDN‑deployable tracking snippet  

Once the client provides the missing technical inputs, the full production solution can be completed quickly.


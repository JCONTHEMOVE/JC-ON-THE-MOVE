# Matt Facebook Page pilot

The enforced pilot path is:

`owner-approved Northwoods campaign -> Matt -> Facebook Page 104318441657764`

Northwoods campaigns cannot use the company publisher. Instagram, Google Business, every other Facebook Page, and every representative except Matt are rejected by the server.

## Verified in Meta on August 31, 2026

- App: **JC Marketing Bot**, app ID `1021149640923592`.
- Business portfolio: **Darrell Jackson**, business ID `184672532251286`.
- App mode: **In development / unpublished**.
- **Facebook Login for Business** and the Pages API use case are installed.
- Client OAuth Login, Web OAuth Login, HTTPS enforcement, and strict redirect matching are enabled.
- Exact valid redirect URI: `https://www.jconthemove.com/api/crew/marketing-bot/meta/callback`.
- `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts` are **Ready for testing**.
- `business_management` is present but is not requested by this pilot.
- Only Darrell is currently an app administrator; Matt is not yet an app-role user.
- Authorized Northwoods Page: **JC on the Move com (Moving Help with JC ON THE MOVE Northern Wisconsin)**, Page ID `104318441657764`.
- Non-pilot Page: **JC on the Move . com**, Page ID `452376794963429`.
- No Instagram product is installed in the app.
- The app-level **Required actions** page has no current tasks.
- Meta Business Suite **Requests -> Needs review** contains one unrelated legacy request from May 25, 2018: a removed Signpost business-portfolio user requesting access to Page `452376794963429`. Do not approve it as part of this pilot.

## Exact Meta dashboard actions still required

1. In **App settings -> Basic**, save:
   - App domain: `jconthemove.com`
   - Contact email: `upmichiganstatemovers@gmail.com`
   - Privacy policy URL: `https://www.jconthemove.com/privacy`
   - Terms of service URL: `https://www.jconthemove.com/terms`
   - User data deletion mode: **Data deletion instructions URL**
   - User data deletion URL: `https://www.jconthemove.com/privacy`
2. In **Meta Business Suite -> Settings -> People**, invite Matthew P. using the email on his approved JC employee record. Give employee/minimum access, not full business control.
3. Assign Matthew P. only the Page **JC on the Move com (Moving Help with JC ON THE MOVE Northern Wisconsin)** (`104318441657764`) and only the access needed to create/manage Page content. Do not assign Page `452376794963429` or any Instagram asset.
4. In the **JC Marketing Bot** app roles, add Matt as a **Tester**, not an administrator or developer. Matt must personally accept the app-role invitation.
5. If either action enters Meta's approval queue, open **Required actions / Requests -> Needs review** and approve only the new Matt tester invitation and the single Page assignment above. Do not respond to the unrelated 2018 Signpost request or approve broader business, Page, partner, or Instagram access.
6. Keep the app in development mode for this role-only pilot. Do not request Advanced Access or publish the app yet.
7. Do not add Live Video API, Page Mentions, `business_management`, `email`, branded-content, or Instagram permissions for this pilot. Page Mentions may be evaluated later if approved campaigns need to tag partner Pages.

Meta invitations and Facebook authorization must be accepted by Matt while signed into his own account.

## Production environment

Verified in Railway production on August 31, 2026:

- Project: `grateful-embrace`
- Service: `jc-on-the-move`
- The service is online at `www.jconthemove.com`.
- `META_APP_ID=1021149640923592`
- `META_GRAPH_API_VERSION=v25.0`
- `META_OAUTH_REDIRECT_URI=https://www.jconthemove.com/api/crew/marketing-bot/meta/callback`
- `MARKETING_META_PILOT_REP_SLUGS=matt`
- `META_APP_SECRET` and `META_OAUTH_TOKEN_ENCRYPTION_KEY` are present; their values are intentionally omitted from this runbook.
- `MARKETING_META_PILOT_PAGE_ID=104318441657764`
- `MARKETING_META_PILOT_PAGE_NAME=JC on the Move com (Moving Help with JC ON THE MOVE Northern Wisconsin)`
- Railway applied the two Page-lock variables in configuration-only deployment `adb70d43-928e-46de-b775-a344cd9f7847`.
- After the rollout, `https://www.jconthemove.com/api/health` returned HTTP 200 with `status=ready` on production commit `723f0638`.

The complete active pilot set is:

```text
META_APP_ID=1021149640923592
META_APP_SECRET=<Meta app secret>
META_GRAPH_API_VERSION=v25.0
META_OAUTH_REDIRECT_URI=https://www.jconthemove.com/api/crew/marketing-bot/meta/callback
META_OAUTH_TOKEN_ENCRYPTION_KEY=<new random secret of at least 32 characters>
MARKETING_META_PILOT_PAGE_ID=104318441657764
MARKETING_META_PILOT_PAGE_NAME=JC on the Move com (Moving Help with JC ON THE MOVE Northern Wisconsin)
MARKETING_META_PILOT_REP_SLUGS=matt
```

Do not reuse `META_APP_SECRET` as the encryption key. Legacy company-publisher values such as `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, and `META_INSTAGRAM_ACCOUNT_ID` do not authorize the Matt pilot.

## Activation and smoke test

1. Deploy the pilot code. The environment values are already active; confirm `/api/health` remains healthy after the code rollout.
2. Sign in as Matt and open **Crew -> Marketing**. The setup card must say **Ready for Matt to authorize** and show Page ID `104318441657764`.
3. Select **Authorize with Facebook** and grant only `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`.
4. The Page chooser must return exactly Page `104318441657764`. Select it and run **Verify**.
5. Generate a campaign with territory **UP / Northwoods**. Confirm the approval queue labels Instagram and Google Business disabled and provides no company publish control.
6. Approve the campaign. Approval must only hand it to Matt; it must not create a Meta post.
7. As Matt, publish the approved variant. Confirm the saved permalink opens on Page `104318441657764`.
8. Confirm a different representative, Page `452376794963429`, a company-publisher request, and an Instagram channel request are all denied.

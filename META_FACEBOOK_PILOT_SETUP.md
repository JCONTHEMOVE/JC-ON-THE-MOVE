# Matt Facebook Page pilot setup

The pilot is intentionally limited to one path:

`owner-approved Northwoods campaign -> Matt -> authorized Facebook Page`

Company Facebook credentials, Instagram, Google Business, non-Northwoods campaigns, and every representative except Matt are rejected by the server for this pilot.

## Meta developer dashboard actions

1. Open the JC app in **Meta for Developers**. Add the **Facebook Login** / **Facebook Login for Business** use case if it is not already present.
2. In **App roles**, add Matt's Facebook account as a tester/developer and have Matt accept the invitation. This keeps the one-person pilot on Standard Access. Do not add the other representatives.
3. In **Facebook Login -> Settings**:
   - enable **Client OAuth Login**;
   - enable **Web OAuth Login**;
   - add this exact **Valid OAuth Redirect URI**: `https://www.jconthemove.com/api/crew/marketing-bot/meta/callback`;
   - keep HTTPS enforcement enabled.
4. In **App Review -> Permissions and Features**, confirm the app can request:
   - `pages_show_list`;
   - `pages_manage_posts`;
   - `pages_read_engagement`.
5. In **Business settings -> Accounts -> Pages**, confirm Matt has Facebook access with permission to create/manage Page content for the single pilot Page. Copy that Page's numeric ID.
6. In **Settings -> Basic**, finish any Meta-required app contact, privacy-policy, terms, user-data-deletion, app-domain, and business-portfolio fields. Use `jconthemove.com` as the app domain.
7. Leave Instagram permissions/products out of this pilot. Do not request `instagram_content_publish`, and do not connect an Instagram account in the JC pilot UI.

App Review/Advanced Access is not required while Matt is an accepted app-role user and the app remains a role-only pilot. Before allowing a non-role user or another representative, complete Business Verification and request Advanced Access for each Page permission above; the application will still reject those users until the code's pilot policy is deliberately changed.

## Production environment actions

Set these variables in the production runtime; never paste their values into source control:

```text
META_APP_ID
META_APP_SECRET
META_GRAPH_API_VERSION
META_OAUTH_REDIRECT_URI=https://www.jconthemove.com/api/crew/marketing-bot/meta/callback
META_OAUTH_TOKEN_ENCRYPTION_KEY
MARKETING_META_PILOT_PAGE_ID=<the one numeric Page ID>
MARKETING_META_PILOT_PAGE_NAME=<operator-facing Page name>
MARKETING_META_PILOT_REP_SLUGS=matt
```

Use a new random secret of at least 32 characters for `META_OAUTH_TOKEN_ENCRYPTION_KEY`. Do not reuse the Meta App Secret.

The legacy `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, and `META_INSTAGRAM_ACCOUNT_ID` variables are not used by the Matt Northwoods pilot publisher. They belong to the separate company-channel publisher.

## End-to-end activation check

1. Deploy the production variables and restart the server.
2. Sign in as Matt and open **Crew -> Marketing**.
3. Confirm the setup card says **Ready for Matt to authorize** and displays the expected Page ID.
4. Select **Authorize with Facebook**, approve all three requested Page permissions, and return to JC.
5. Confirm the Page chooser shows exactly one Page. If it shows none, Matt lacks access to the configured Page ID or a required permission was declined.
6. Select the Page and run **Verify**. The setup card must say **Ready to publish approved Northwoods campaigns**.
7. In **Admin -> Campaign Publishing -> Approval queue**, approve one Northwoods proposal. Approval must not publish it.
8. Return as Matt, publish the approved Facebook variant, and confirm the saved permalink opens on the configured Page.
9. Confirm there is no Instagram publish control and that another representative receives a pilot access denial.

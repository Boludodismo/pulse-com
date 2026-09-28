# Cores na Pele — standalone reading route

The owner requested access by link at https://crm.tatuei.com/estudos/cores/ for iPhone use.

The route serves the previously approved reader (27 original page images, extracted mobile-friendly text and the supplied compressed MP3). It does not read or modify CRM data. No authentication, scheduler, database or existing storage route is changed. It is public to anyone with the link and sends noindex headers; these headers are not access control.

The 40,380,868-byte uploaded ZIP is pinned to SHA-256 01fca88802f3a428c0c869031a80ae9c28888f6e1080df6219c96e3476465a59. On first installation, set CORES_READER_BUNDLE_URL to the temporary HTTPS transfer URL for exactly that ZIP. It is verified and stored under the dedicated learning/cores-na-pele prefix of existing storage. Subsequent startups restore from durable storage. The temporary URL is not committed or included in HTML. Once installed, the transfer variable may be removed.

Only 39 explicitly allowlisted book assets are extracted into a temporary directory and served read-only. MP3 delivery supports byte ranges with audio/mpeg. The service worker is scoped to /estudos/cores/ and is not allowed to handle paths outside that scope. The existing CRM keeps running if book initialization fails. No additional service is provisioned.

The reader does not claim automatic page/word synchronization. Pages are manual unless the user records their own page/time marks. Audio playback requires the user to tap play. Notes/progress remain local to the browser. Offline caching is optional and must complete before disconnection.

Local checks before deployment: TypeScript transpilation and browser-JavaScript syntax; all 39 assets extracted from the checksum-verified archive; corrupt/truncated bundles rejected; original PDF and MP3 preserved; hosted messages and service-worker scope changes checked. Physical iPhone behavior still requires device confirmation.

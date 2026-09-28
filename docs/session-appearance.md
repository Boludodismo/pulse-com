# Session appearance

The cockpit uses Tatuei orange, black and white; active states and the timer use green. Sample and pigment colors are never replaced by theme colors.

Material buttons are still generated exclusively from `sessionMaterials`. Their glyphs are inline SVG outlines selected from the material name/category/configuration. Unknown types receive a neutral package glyph. Stored pigment samples fill the ink icon. Cup colors require an explicit `cupTenantMaterialId` link to an active recipe: measured result takes priority, then the sample target, with their source identified in the description. Recipes without that inventory association do not color an unrelated cup. No pigment is inferred from a color name or calculated by averaging a mixture.

Hover, keyboard focus and a 450 ms touch/pen hold show a description. A hold suppresses the ensuing consumption click; scrolling cancels the hold. Tooltips remain reachable in browser fullscreen and close with Escape or their close button.

The focus toolbar occupies the top row; both docks start below it, including their collapsed buttons. Materials retain their independent vertical scrollbar. Size uses layout dimensions rather than transforming the entire dock, keeping controls and hit areas aligned.

`artist_session_appearance` is an additive table, created idempotently by the existing startup schema bootstrap. It stores a validated versioned JSON layout, keyed by studio and artist, with a revision for concurrent edits. It does not modify sessions, stock, images or recipes. Signed-in collaborators use their linked artist; administrators edit the artist assigned to the accessible session. Ownership and studio checks apply to both reads and writes.

The appearance screen saves size/background opacity for materials, layers, tools and palette, plus the dock expanded/collapsed states. It loads the artist's settings in subsequent sessions for any client. Saving is explicit; reset changes the preview until saved. Concurrent stale saves are rejected and the screen offers reloading the stored values. Text/icons retain opacity for legibility.

Validation: shared classification, real color precedence and bounds tests; MySQL integration checks persistence across clients, isolation from other artists/studios, revision conflicts, repeated schema bootstrap and unchanged inventory.

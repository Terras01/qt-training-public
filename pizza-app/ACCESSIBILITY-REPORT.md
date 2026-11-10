# Accessibility Audit: Neighborhood Pizza (WCAG 2.2 Level AA)

> **Draft for review.** This is an automated and scripted audit. A person should check it, and a screen reader pass is still needed before anyone treats it as final (see [Limitations](#limitations)).

| | |
|---|---|
| **Standard** | WCAG 2.2, Level A and AA (W3C Recommendation, 5 Oct 2023). This is the current version. WCAG 3.0 is still a W3C Working Draft, so you can't conform to it yet. |
| **App version** | Branch `pass-2`, commit `26e9426` |
| **Pages tested** | Customer ordering page `/` (empty, with cart, with validation errors, order confirmation) and kitchen board `/kitchen` (New and Ready orders) |
| **Browser** | Microsoft Edge (Chromium), driven by Playwright 1.65 |
| **Date** | 2026-11-10 |

## Summary

The app has a solid base: semantic HTML, real form controls, labels, landmarks, a visible focus ring and responsive layout. Most WCAG 2.2 criteria pass. There are **4 failures and 2 items that need a decision**. Most fixes are small changes to the CSS or to Vue components.

| # | Issue | WCAG SC | Level | Result | Severity |
|---|---|---|---|---|---|
| 1 | Header nav links don't have enough text contrast | 1.4.3 Contrast (Minimum) | AA | **Fail** | High |
| 2 | Amber focus ring is only 2.08:1 against white | 1.4.11 Non-text Contrast | AA | **Fail** | High |
| 3 | Focus jumps to the top of the page after Remove, Mark Ready, Undo, and Start a new order | 2.4.3 Focus Order | A | **Fail** | High |
| 4 | Checkout error messages and "Added to your order" are unlikely to be announced by screen readers | 4.1.3 Status Messages | AA | **Fail** (screen reader check pending) | High |
| 5 | Kitchen board refreshes every 5 seconds with no way to pause | 2.2.2 Pause, Stop, Hide | A | **Needs decision** | Medium |
| 6 | Name field border is 1.61:1 against white | 1.4.11 Non-text Contrast | AA | **Likely fail** (needs reviewer judgment) | Medium |
| 7 | Repeated control names with no context ("Remove", "Mark Ready", "Increase quantity") | 2.4.6 Headings and Labels | AA | Advisory | Medium |
| 8 | Confirmation view has no `<h1>` and keeps the old page title | 1.3.1 / 2.4.2 | A | Advisory | Low |
| 9 | Required name field isn't marked as required | 3.3.2 Labels or Instructions | A | Advisory | Low |
| 10 | Emoji in the brand link and messages are read aloud | 1.1.1 Non-text Content | A | Advisory | Low |

"Advisory" means the item doesn't clearly fail the success criterion as written, but it's a common audit finding that makes the app harder to use with assistive technology.

---

## Failures

### 1. Header navigation contrast: SC 1.4.3 (AA), Fail

axe-core flagged this on every page.

| Element | Foreground / background | Ratio | Needed |
|---|---|---|---|
| Inactive nav link (`opacity: 0.85`) | #f6e1df on #c0392b | **4.33:1** | 4.5:1 |
| Active nav link (`rgba(255,255,255,.18)` overlay) | #ffffff on #cb5d51 | **4.02:1** | 4.5:1 |

**Where:** [style.css:33-34](client/src/style.css#L33-L34)

**Suggested fix:** Remove the `opacity: 0.85` and keep the text solid white. For the active and hover state, darken the background instead of lightening it, for example `background: var(--red-dark)` (#962d22). White on #962d22 is **7.79:1**. The active link already has `aria-current="page"`, so screen readers announce the current page.

### 2. Focus indicator contrast: SC 1.4.11 (AA), Fail

The global focus ring is a 3px solid #f0a500 outline. It's visible, so SC 2.4.7 Focus Visible passes. But the indicator doesn't reach the 3:1 contrast that 1.4.11 requires for visual information that identifies a component's state:

| Ring against | Ratio |
|---|---|
| White card (#fff), where most controls sit | **2.08:1** |
| Page background (#faf7f2) | **1.95:1** |
| Red header (#c0392b) | **2.61:1** |

This matters most on the size and topping options. There the ring wraps only the 18 px native radio or checkbox, not the whole option card.

**Where:** [style.css:56](client/src/style.css#L56)

**Suggested fix:** Use a two-tone ring, which works on light backgrounds and on the red header:

```css
button:focus-visible, input:focus-visible, a:focus-visible {
  outline: 3px solid #1a1a1a;           /* 17.4:1 on white, 3.2:1 on the red header */
  outline-offset: 2px;
  box-shadow: 0 0 0 5px #fff;           /* white halo keeps it visible on dark/red surfaces */
}
/* Optional: show focus on the whole option card, not just the 18px input */
.option:has(input:focus-visible) { outline: 3px solid #1a1a1a; outline-offset: 2px; }
```

### 3. Focus is lost when the focused control disappears: SC 2.4.3 (A), Fail

In four places, the button the user just pressed is removed from the page. Focus then falls back to `<body>`. Keyboard and screen reader users have to tab from the top of the page again, which on the kitchen board means going through every order.

| Action | Where | Focus went to |
|---|---|---|
| **Remove** a cart line | [CartList.vue:47](client/src/components/CartList.vue#L47) | `<body>` |
| **Mark Ready** on a kitchen card (the card moves to the Ready column) | [OrderCard.vue:35](client/src/components/OrderCard.vue#L35) | `<body>` |
| **Undo, move back to New** (the card moves back) | [OrderCard.vue:38](client/src/components/OrderCard.vue#L38) | Expected `<body>` (same code pattern, not measured separately) |
| **Start a new order** on the confirmation | [OrderConfirmation.vue:26](client/src/components/OrderConfirmation.vue#L26) | `<body>` |

Good news: focus *does* survive the kitchen board's 5-second auto-refresh, and placing an order moves focus to the confirmation heading as intended.

**Suggested fix:**
- **Remove:** Move focus to the next cart line's Remove button, or to the previous one if none is left. If the cart is now empty, move it to the "Your order" heading. Give that heading `tabindex="-1"`.
- **Mark Ready / Undo:** After the update, move focus to the next "Mark Ready" button in the New column. If none is left, move it to the column heading. Also announce the result (see #4).
- **Start a new order:** Move focus to the `<h1>` "Order for pickup". Give it `tabindex="-1"` and focus it in `onMounted` or after `confirmedOrder` is cleared.

### 4. Status messages likely not announced: SC 4.1.3 (AA), Fail (screen reader check pending)

The DOM checks below show the problem. Screen reader behavior should still be checked with NVDA, JAWS or Narrator (see Limitations).

**a. Checkout validation errors.** When the user clicks **Place pickup order** with a blank name or an empty cart, focus stays on the button. The errors appear in `#checkout-help`, which has `aria-live="polite"`. But CSS hides that element while it's empty: `.field-help:empty { display: none; }`. The audit confirmed `display: none` before the user submits. A live region that is `display: none` isn't in the accessibility tree. When it appears together with its text, most screen readers treat it as new content, not as a change to a live region, and say nothing. So a blind user presses the button and hears nothing.

- **Where:** [style.css:112](client/src/style.css#L112) and [OrderView.vue:115](client/src/views/OrderView.vue#L115)
- **Suggested fix:** Keep the live region rendered and only hide its contents visually (remove the `:empty` rule). Better still, follow the common form-error pattern: on a failed submit, move focus to the first invalid field. Focus the name input, or the "Your order" heading when the cart is empty.
- **Related:** The "add at least one pizza" message is linked to the *name* input through `aria-describedby`. A screen reader user on the name field would hear a cart error that has nothing to do with that field. Put the cart error near the cart instead.

**b. "✓ Added to your order".** This `role="status"` paragraph is created by `v-if` at the same moment as its text, and it's removed after 2 seconds (measured 1,980 ms). Screen readers often skip live regions that are inserted already holding content. Two seconds is also very short for screen magnifier users to find it.

- **Where:** [PizzaBuilder.vue:93](client/src/components/PizzaBuilder.vue#L93) and [PizzaBuilder.vue:30](client/src/components/PizzaBuilder.vue#L30)
- **Suggested fix:** Always render an empty `<p role="status">` and change only its text, for example "Added 2 Large pizzas to your order". Keep the visible message for at least 5 seconds, or until the next action.

**c. Kitchen "Mark Ready".** Nothing is announced when an order is marked Ready, and nothing is announced when new orders arrive. The only visible signal is the card moving to the other column. Add one polite live region to the kitchen board, for example "Order #12 for Alex marked Ready" and "1 new order: #13 Sam".

---

## Items needing a decision

### 5. Kitchen board auto-refresh: SC 2.2.2 (A), Needs decision

The kitchen board updates itself every 5 seconds ([KitchenView.vue:6](client/src/views/KitchenView.vue#L6), [KitchenView.vue:54](client/src/views/KitchenView.vue#L54)), including the visible "Updated 3:04:15 PM" timestamp. SC 2.2.2 requires a way to pause, stop or hide auto-updating content that runs alongside other content, *unless the auto-updating is essential*.

There are two ways to resolve this. A team member needs to choose:
- **Option A (recommended):** Add a "Pause auto-refresh" toggle next to "Refresh now". It's low effort and removes the question entirely.
- **Option B:** Write down that live updating is essential to the kitchen board's purpose. That's a fair argument for a kitchen order screen, but it should be a documented decision.

### 6. Name input border contrast: SC 1.4.11 (AA), Likely fail

The **Name for pickup** border is #ccc on white, which is **1.61:1** (3:1 needed). The label above and the "Your name" placeholder do help locate the field, and some auditors accept that. Most treat a low-contrast text input boundary as a 1.4.11 failure.

- **Where:** [style.css:110](client/src/style.css#L110)
- **Suggested fix:** `border: 1px solid #767676;` gives 4.54:1. #949494 is the lightest gray that still passes, at 3.03:1.

---

## Advisory items

7. **Repeated, context-free control names (2.4.6).** Each cart line has buttons named "Decrease quantity", "Increase quantity" and "Remove". Each kitchen card has "Mark Ready". A screen reader user browsing a list of buttons can't tell which pizza or order a button belongs to. Add context, keeping the visible text at the start of the name so that SC 2.5.3 Label in Name still passes. For example, `aria-label="Remove Large (14″) Pepperoni, Mushrooms"` and `aria-label="Mark Ready, order 12 for Alex"`. Also, the cart quantity number isn't announced when it changes. The builder's quantity is, because it has `aria-live`.
   [CartList.vue:27-47](client/src/components/CartList.vue#L27-L47), [OrderCard.vue:14-39](client/src/components/OrderCard.vue#L14-L39)
8. **Confirmation view structure (1.3.1 / 2.4.2).** When the confirmation replaces the order form, the page has no `<h1>`: axe "page-has-heading-one" fired, and the only heading is the `<h2>` "Thanks, Pat!". The `<title>` also still says "Order for Pickup". Make the confirmation heading an `<h1>` and update `document.title`, for example "Order #12 confirmed". The whole confirmation card also has `role="status"` while its heading gets focus, so some screen readers may read the content twice. The focus move on its own is enough.
   [OrderConfirmation.vue:15-17](client/src/components/OrderConfirmation.vue#L15-L17)
9. **Required field not marked (3.3.2).** Nothing tells the user that **Name for pickup** is required until they submit. Add "(required)" to the label, or a visible marker with `aria-required="true"`.
   [OrderView.vue:102-112](client/src/views/OrderView.vue#L102-L112)
10. **Emoji read aloud (1.1.1).** Screen readers read the brand link as "slice of pizza Neighborhood Pizza". The empty kitchen column reads "No orders waiting. party popper". Wrap decorative emoji in `<span aria-hidden="true">`. The ✓ on the confirmation already does this.
    [App.vue:8](client/src/App.vue#L8), [KitchenView.vue:83](client/src/views/KitchenView.vue#L83), [PizzaBuilder.vue:93](client/src/components/PizzaBuilder.vue#L93)

Two smaller notes:
- The builder's price summary is an `aria-live` region holding the whole price breakdown. Every topping change re-reads all of it. Consider announcing only the new "Price per pizza".
- The kitchen column headings read "New 3" and "Ready for pickup 1". Add hidden text so they read "New, 3 orders".

---

## What passed

| SC | Level | Result |
|---|---|---|
| 1.3.1 Info and Relationships | A | Pass: fieldset/legend for size and toppings, real `<label>`s, list markup, landmarks (`header`, `nav`, `main`) |
| 1.3.5 Identify Input Purpose | AA | Pass: `autocomplete="given-name"` |
| 1.4.1 Use of Color | A | Pass: status shown with text ("New"/"Ready"), selection shown by the native control, Remove links underlined |
| 1.4.3 Contrast (body content) | AA | Pass apart from #1. Muted text is 5.66:1, white on red buttons 5.44:1, Ready badge 4.58:1 |
| 1.4.4 Resize Text | AA | Pass: no horizontal scroll at 200% zoom |
| 1.4.10 Reflow | AA | Pass: no horizontal scrolling at 320 CSS px on the order page or the kitchen board |
| 1.4.12 Text Spacing | AA | Pass: no clipped or overlapping text with WCAG text-spacing overrides applied |
| 2.1.1 Keyboard | A | Pass: every function works by keyboard. Size radios use arrow keys as expected |
| 2.4.1 Bypass Blocks | A | Pass: landmarks present and the header has only 3 links. A skip link would still be a nice addition |
| 2.4.2 Page Titled | A | Pass: route-based titles (see #8 for the confirmation) |
| 2.4.7 Focus Visible | AA | Pass: every tab stop showed a 3px outline (contrast covered in #2) |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Pass: no sticky headers or overlays cover focused items |
| 2.5.3 Label in Name | A | Pass: "−"/"+" are symbols, so the "Decrease/Increase quantity" names are fine |
| 2.5.8 Target Size (Minimum) | AA | Pass: radio and checkbox inputs are 17.6 px, but each is wrapped in a full-size clickable label card. Steppers are 32–38 px |
| 3.1.1 Language of Page | A | Pass: `lang="en"` |
| 3.3.1 Error Identification | A | Pass: errors described in text and `aria-invalid` set (announcement issue in #4) |
| 3.3.4 Error Prevention (Financial) | AA | Pass: the cart can be reviewed and changed next to the submit button before ordering, and payment happens at the counter |
| 3.3.7 Redundant Entry | A | Pass: name and cart are kept in localStorage |
| 4.1.2 Name, Role, Value | A | Pass: native controls throughout, and axe found no ARIA errors |
| Windows High Contrast (forced colors) | n/a | Renders correctly. Controls, borders and checked states stay visible |

**Not applicable:** 1.2.x (no audio or video), 2.5.7 Dragging Movements (no dragging), 3.2.6 Consistent Help (no help feature), 3.3.8 Accessible Authentication (no login).

---

## Method

1. **Automated scan:** axe-core 4.14 with rule tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`. It was injected through Playwright into 6 page states at 1280 px and 320 px.
2. **Scripted checks in Playwright**, for things axe can't judge:
   - full keyboard tab order, and the focus style at every stop
   - where focus lands after each action that removes content
   - target size of every interactive element
   - reflow at 320 px and 200% zoom
   - WCAG 1.4.12 text-spacing override
   - live region inventory and lifecycle
   - focus kept across the kitchen auto-refresh
   - forced-colors (Windows High Contrast) rendering
   - contrast ratios for non-text UI parts such as focus rings and borders
3. **Code review** of every Vue component and `style.css` to explain each result and find its source line.

The app ran on its real server with a throwaway SQLite database, so the audit didn't touch `server/data/pizza.db`.

## Limitations

- **No real screen reader was used.** Findings #4 and #7 are based on how NVDA, JAWS, VoiceOver and Narrator usually handle these patterns. They should be confirmed by hand. Narrator on Windows is a good free option.
- Automated tools catch roughly a third to a half of WCAG issues. Reading order with magnification, and how understandable the content is for people with cognitive disabilities, weren't fully assessed.
- Only Edge/Chromium was tested. Firefox and Safari weren't.

## Recommended next steps

1. Fix #1 and #2 (CSS only, about 15 minutes) and #6 (one line).
2. Fix #3 and #4 (focus management and live regions in 4 components).
3. A team member decides on #5 (pause toggle, or document it as essential).
4. Add an `@axe-core/playwright` check to the existing e2e suite so contrast and ARIA regressions fail CI. For example, run `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()` in each spec.
5. Do one manual pass with a screen reader through the full order flow and the kitchen flow.

## Sources

- [WCAG 2.2 (W3C Recommendation)](https://www.w3.org/TR/WCAG22/)
- [What's New in WCAG 2.2 (W3C WAI)](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- [How to Meet WCAG 2.2 (Quick Reference)](https://www.w3.org/WAI/WCAG22/quickref/)
- [WCAG 2 Overview (W3C WAI)](https://www.w3.org/WAI/standards-guidelines/wcag/)
- WCAG 3.0 status: [AbilityNet WCAG 3.0 overview](https://abilitynet.org.uk/resources/digital-accessibility/what-expect-wcag-30-web-content-accessibility-guidelines), [Wikipedia: WCAG](https://en.wikipedia.org/wiki/Web_Content_Accessibility_Guidelines)

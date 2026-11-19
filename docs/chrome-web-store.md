# Publishing the CareerOS extension to the Chrome Web Store

Everything needed for the submission is in the repository. The steps marked **(you)** need the team's Google
account and cannot be automated.

| What | Where |
| --- | --- |
| Upload package | `npm run package:extension` → `extension/release/careeros-extension-<version>.zip` |
| Store icon (128×128, 96×96 artwork + 16 px padding) | `extension/store/store-icon-128.png` |
| Screenshots (1280×800) | `extension/store/screenshot-uk-*.png` (Ukrainian listing), `screenshot-en-*.png` (English) |
| Small promo tile (440×280, optional) | `extension/store/promo-tile-440x280.png` |
| Privacy policy | <https://d34opbkbhqypsa.cloudfront.net/privacy> (has a "CareerOS Chrome extension" section) |

The screenshots show a real, public Djinni vacancy (King Group) with a made-up student's results. If you prefer
not to show a real company, retake them on another vacancy.

## 1. Register a developer account (you)

1. Open <https://chrome.google.com/webstore/devconsole> with the Google account the team will keep.
   The developer email **cannot be changed later**.
2. Accept the developer agreement and pay the **one-time registration fee** (US$5 at the time of writing; the
   dashboard shows the exact amount). This is the only cost — the AWS side stays in the free tier.
3. On the **Account** page, fill in the publisher name (e.g. "CareerOS team") and verify the contact email.

## 2. Build the package

```bash
npm run deploy               # only if frontend/.env.production is missing or the stack changed
npm run package:extension    # → extension/release/careeros-extension-1.0.0.zip
```

The store package differs from the development build in one way: it has no `"key"` (the store assigns its own
id; the extension does not depend on a fixed id). It contains your API host in `host_permissions`, so build it
from the stack you want the published extension to use.

## 3. Create the item and fill in the store listing (you)

**New item → upload the ZIP**, then the **Store listing** tab. Set **Ukrainian** as the default language and add
**English** as a second language with the texts below.

- **Category:** Productivity → Workflow & Planning (or "Tools").
- **Store icon:** `store-icon-128.png`. **Screenshots:** the three `screenshot-uk-*` (English listing:
  `screenshot-en-*`). **Small promo tile:** `promo-tile-440x280.png`.
- **Homepage URL:** <https://d34opbkbhqypsa.cloudfront.net> · **Support URL:** the GitHub issues page of the repo.

### Ukrainian

**Назва:** CareerOS — CV під вакансію

**Короткий опис** (з маніфесту, 123 символи): Порівняй своє CV з вакансією на Djinni, DOU чи Work.ua: оцінка, яких
навичок бракує, чесне покращене CV і супровідний лист.

**Детальний опис:**

```text
CareerOS допомагає студентам і джунам в ІТ отримати першу роботу — просто на сторінці вакансії, у момент відгуку.

Відкрий вакансію на Djinni, DOU чи Work.ua і натисни іконку CareerOS. Бічна панель:
• прочитає вакансію зі сторінки й порівняє її з твоїм CV — оцінка від 0 до 100;
• покаже, які навички в тебе вже є, яких бракує, і як закрити прогалини;
• перепише CV під цю вакансію — лише перефразує й переставить твої реальні факти, нічого не вигадує
  (а все підозріле підсвічує для перевірки); завантаж як PDF;
• напише короткий супровідний лист українською чи англійською і вставить його у форму відгуку;
• після відгуку запропонує додати вакансію в трекер заявок разом із CV, яке ти надіслав(-ла);
• покаже твою оцінку на іконці на вже проаналізованих вакансіях.

Потрібен безкоштовний акаунт CareerOS (реєстрація на сайті). Свої версії CV, історію, трекер і тренування
співбесід ти ведеш на сайті CareerOS — розширення працює з тими самими даними.

Приватність: розширення працює лише на djinni.co, jobs.dou.ua і work.ua, читає сторінку тільки коли панель
відкрита й нічого не надсилає, доки ти не натиснеш «Порівняти моє CV». Без реклами й аналітики; дані не
продаються й не передаються.
```

### English

**Name:** CareerOS — CV for this vacancy

**Summary** (from the manifest, 127 characters): Match your CV to the vacancy you see on Djinni, DOU or Work.ua:
score, missing skills, an honest CV rewrite and a cover letter.

**Description:**

```text
CareerOS helps students and junior IT specialists in Ukraine land their first job — right on the vacancy page,
at the moment they apply.

Open a vacancy on Djinni, DOU or Work.ua and click the CareerOS icon. The side panel:
• reads the vacancy from the page and matches it with your CV — a score from 0 to 100;
• shows which skills you already have, which are missing, and how to close the gaps;
• rewrites your CV for this vacancy — it only rephrases and reorders your real facts and never invents
  anything (anything suspicious is highlighted for you to check); download it as PDF;
• writes a short cover letter in Ukrainian or English and puts it into the site's application form;
• after you apply, offers to add the vacancy to your application tracker with the CV you sent;
• shows your score on the icon for vacancies you have already analysed.

A free CareerOS account is required (sign up on the website). Your CV versions, history, tracker and interview
practice live on the CareerOS website — the extension works with the same data.

Privacy: the extension works only on djinni.co, jobs.dou.ua and work.ua, reads the page only while the panel is
open, and sends nothing until you press "Match my CV". No ads, no analytics; data is never sold or shared.
```

## 4. Privacy practices tab (you)

**Single purpose:**

> Help job seekers tailor their CV to the vacancy they are viewing on Djinni, DOU or Work.ua: match score, missing
> skills, an honest CV rewrite, a cover letter for the application form, and tracking the application.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `sidePanel` | The whole interface is a side panel shown next to the vacancy page, so the user can work with their CV while applying. |
| `scripting` | When the panel is open on a vacancy page, it reads that page's vacancy text, puts the cover letter into the site's application form when the user asks, and notices clicks on the site's apply button to offer adding the vacancy to the user's tracker. Only on the job sites listed in host permissions. |
| `storage` | Keeps the sign-in session and, per analysed vacancy, the result id and score (to show the last result and the score on the toolbar icon) in the browser. Cleared on sign-out. |
| Host `djinni.co`, `jobs.dou.ua`, `work.ua`, `www.work.ua` | The supported job sites: the extension reads the vacancy on these pages only. |
| Host `https://10oq2txoch.execute-api.us-east-1.amazonaws.com/*` (our API; your stack's API URL) | The CareerOS backend API: loads the user's CVs and sends the vacancy for analysis, cover letters and the tracker. |

**Remote code:** "No, I am not using remote code." (All code is in the package; only Google Fonts CSS is loaded.)

**Data usage** — check what is sent off the device:

- **Personally identifiable information** — yes: the CV text the user saved on CareerOS (may contain name and
  contacts) is loaded for analysis.
- **Authentication information** — yes: email and password are sent to Amazon Cognito to sign in.
- **Website content** — yes: the vacancy text of the page, when the user presses "Match my CV".
- Leave the rest unchecked (health, financial, personal communications, location, web history). **User
  activity:** apply-button clicks are only handled locally to show a prompt and are not sent anywhere, so this is
  not "collected"; if the reviewer disagrees, check it — nothing else changes.

Check all three certifications (not sold to third parties; not used for unrelated purposes; not used for
creditworthiness/lending). **Privacy policy URL:** <https://d34opbkbhqypsa.cloudfront.net/privacy>.

## 5. Distribution and test instructions (you)

- **Visibility:** *Unlisted* is enough for the course demo (anyone with the link can install); switch to *Public*
  later. **Regions:** all, or at least Ukraine.
- **Test instructions** — the reviewers need an account. Create a demo account on the website (a team email you
  can confirm), save one CV in "My CVs", and paste into the "Test instructions" field:

```text
1. Sign in to the side panel with: <demo email> / <demo password>
2. Open https://djinni.co/jobs/ and any vacancy page, click the CareerOS toolbar icon.
3. Press "Порівняти моє CV" (Match my CV) — the result appears in ~20 s.
4. Press "Написати супровідний лист", then "Вставити у форму відгуку" — the letter goes into Djinni's form
   (nothing is submitted).
```

Then **Submit for review**. Reviews usually take from a few days up to a couple of weeks; Google emails the
result. Typical rejection reasons are a missing permission justification or a listing that does not match what
the extension does — the texts above are written to match the code.

## After publishing

- **Updates:** bump `version` in `extension/manifest.base.json` and `extension/package.json`, run
  `npm run package:extension`, and upload the new ZIP under **Package** in the dashboard.
- **Same id for local development (optional):** dashboard → Package → *View public key*, put that value into
  `"key"` in `extension/manifest.base.json`. Then the unpacked build and the store item share one id.
- **New AWS stack:** the API host is built into the package — rebuild and upload after deploying to a new stack.

# CareerOS — 3-minute demo script

**Before the demo (10 min earlier):**
- Run `npm run smoke` — all 10 checks pass.
- Have a short CV as a PDF and a vacancy text copied (a real junior vacancy from DOU or Djinni works best).
- Sign in on a phone or a narrow browser window; keep a second tab signed in as an admin on `/admin`.
- Gemini can be slow at peak times: if an AI step shows "temporarily unavailable", press the button again.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | Landing page | "Junior IT job seekers in Ukraine send dozens of CVs and hear nothing back. CareerOS shows why — for each vacancy — without inventing a single fact." |
| 0:20–0:40 | **Sign up** (e-mail, password, "where did you hear about us", consent) → code from e-mail | "Real sign-up with e-mail verification through Amazon Cognito. Ukrainian by default, English with one tap." |
| 0:40–1:25 | **New analysis**: upload the PDF, paste the vacancy, **Analyse** | "The PDF is read in the browser. Gemini compares it with the vacancy: a match score, skills I have, skills and keywords I'm missing — with advice instead of fake lines in my CV." Scroll to the rewrite: "The CV is reordered and reworded; anything the CV didn't contain would be highlighted for me to check." |
| 1:25–1:40 | **Share result** → open the share link | "A before → after card I can send to friends — no CV text in it." |
| 1:40–2:00 | **Add to tracker** → board → drag the card to *Interview* | "Every application remembers which CV version I sent, so the summary shows which CV gets more replies." |
| 2:00–2:40 | **Practise interview** → answer one question → see the score | "6–8 questions for this exact vacancy and CV. Each answer gets a score, feedback and a better example — with [placeholders] where I have to add my own facts, never invented ones." |
| 2:40–3:00 | Switch to the **`/admin`** tab | "For our report: sign-ups per day, real use and return against our targets, sources, feedback and donations — exportable as an anonymised CSV. All of it runs on the AWS free tier." |

**If something fails live:** use an existing analysis from History and the finished interview from
"My interviews" instead of creating new ones.

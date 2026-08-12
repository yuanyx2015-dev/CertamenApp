# Video #1 — "Zero to the App Store: The 100-Day Path"

**Working title:** Zero to the App Store: The 100-Day Path
**Alt title:** I Couldn't Write One Line of Code. Here's the 100-Day Route to the App Store.
**Thumbnail:** your face, the phone showing CertamenPrep, and "100 DAYS". Three elements, nothing else.

**Runtime target:** ~13 min · **Narration:** 1,443 words as written, ~1,650 once the FILLs are in · 11.8 min at 140 wpm, plus roughly a minute of silent scene holds

## Conventions

- `[SCENE: ...]` — something happens on screen and **you stop talking**. These are the moments the video lives on. Do not narrate over them.
- `[B-ROLL: ...]` — visual under narration.
- `[FILL: ...]` — a fact only you have. Every one is indexed at the bottom.
- `(NOTE: ...)` — production reminder, never spoken.

## Before you record

Four claims in this script are **not yet verified**. Confirm each or cut the line:

1. That the app is live on the App Store, and the submitted/live dates. Everything in §6 and §7 depends on it.
2. Whether 1.0.1 (May 4) or 1.0.2 (Jun 14) reached users before Jun 27. Decides the AI tutor line in §4.
3. The real build count. "Build 13" is inferred from a branch name, not a fact.
4. Whether the June rename was a name-availability problem or a branding choice.

**Scrub before any screen capture:** Apple Team ID, bundle ID, Supabase URL and anon key, Gemini API key, tester emails, and the DSA trader address and phone on your product page.

If any error screenshot is a recreation, say so on camera as it appears.

---

## 1. COLD OPEN — 0:00–0:50

`[SCENE: full screen, editor, components/LoginScreen.tsx at the Feb 8 commit. Three seconds of silence. Slow scroll to the three login buttons.]`

This is everything I built on my first day. A login screen. Three buttons.

`[SCENE: highlight onPress={() => {}} on the Apple and Instagram buttons. Hold two seconds, silent.]`

Two of them do nothing. That's an empty function. You press it, and the app does not react.

`[B-ROLL: cut to phone — CertamenPrep on the App Store, open it, play one question, buzz in, answer.]`

Same app, now. [FILL 1]

In February I could not write one line of code. Not one.

Between those two screens: a hundred and seventy-seven days, ninety-nine dollars, and four decisions I got wrong. This video is the whole route — what you actually need, what it actually costs, and how you do it in about a hundred days instead of my hundred and seventy-seven.

`[B-ROLL: fast scroll through the full commit history, 143 commits.]`

I kept every receipt. You get to skip the bill.

---

## 2. WHAT IT ACTUALLY TAKES — 0:50–2:40

Five things. That's the entire list, and almost nobody states it plainly.

**One: a computer.** You'll hear "you need a Mac." That's half true, and it stops people who don't need stopping, so let me be exact. Apple's own tool, Xcode, only runs on macOS. But the toolkit I used — Expo — builds your iOS app on a rented Mac in the cloud and submits it for you. You can ship to the App Store from a Windows machine. I used a Mac because I had one and it makes the daily work easier. It is not the wall people think it is.

**Two: ninety-nine dollars a year**, to Apple, for the Developer Program. There's no way around that one.

**Three: you have to be a legal adult where you live.** If you're not, a parent or guardian holds the account. No workaround. Better to know that today than in month three.

**Four: an iPhone to test on.** Yours is fine.

**Five: one to two hours a day.** Not eight. I'll show you the real number later and it's smaller than you'd guess.

Here's what is *not* on that list: a degree, a bootcamp, being good at math, or any experience at all.

[FILL 2]

---

## 3. THE STARTING LINE MOVED — 2:40–3:50

Here's why "I can't code" is a smaller problem than it was three years ago.

`[B-ROLL: terminal — create-expo-app running, then the blank app booting in the simulator. Speed up. ~8 seconds.]`

One command gives you a running app. So the job was never writing code from a blank page. The job is fixing what's already in front of you — and that looks like this.

`[SCENE: a real error from one of your fix/ commits, full screen. Read the first line of it out loud. Then show the fix. ~20 seconds. FILL 3.]`

That's most of the work. The error tells you what's wrong, in English, usually on the first line. Most beginner "bugs" are solved by reading before asking anyone — human or AI.

How to actually learn this — the method, the AI habits, the traps that eat months — is episode four. It's too big to cram in here.

---

## 4. THE FOUR DECISIONS THAT SET YOUR TIMELINE — 3:50–7:30

This is the part that decides whether you're done in a hundred days or still going at three hundred.

Write this down: **every feature is a loan, and App Review is when the bank calls.**

I can prove that, because my history is a stack of receipts.

### Decision one: login

My very first commit had a Google Sign-In button on it. It felt professional. Here's what that button actually cost.

Apple's rules say that if you offer a third-party login — Google, Facebook, any of them — you have to also offer an equivalent option that collects nothing but a name and an email and lets people keep the email private. In practice, that means Sign in with Apple. A second login, harder than the first, that I now owed.

Then, because you're not allowed to lock features behind a signup they don't require, I owed a guest mode too.

`[B-ROLL: April 2 — feature/add-guest-mode-for-app-store-compliance and feature/add-apple-sign-in-authentication, side by side, same day.]`

Both of those, same day, both forced by a button I added in February. Then in July, two more fixes to make each login button match its official branding — Apple's on the ninth, Google's on the sixteenth.

Every one of those bills came from a checkbox I ticked on day one. Plain email login, or no accounts at all, and not one of them exists.

**Rule one: no accounts in version one, unless your app is literally about accounts.**

### Decision two: screens before substance

On February thirteenth I built six screens in a single day.

`[B-ROLL: the six component files appearing, timestamped Feb 13.]`

I wired them together four days later. And the app first did the thing it exists to do — show a practice question — on March third. Day twenty-three.

Twenty-three days of a beautiful app that did nothing.

**Rule two: build one thin slice of the real thing, end to end, before a second screen exists.**

### Decision three: the pet feature

I built an AI tutor. Started it March twenty-second. Improved it in May. Deleted the screen on June twenty-seventh. [FILL 4]

Three months of a feature's life, and both dates are sitting in my own history.

I'm not telling you to kill your good ideas. **Rule three: keep a version-two list, and make the good ideas wait there and earn their place.**

### Decision four: the app you ship is smaller than the app you imagine

I set out to build online multiplayer Certamen. Head-to-head matches, challenge a friend, play a stranger. That was the entire idea.

`[SCENE: the July 16 commit diff, full screen. 1,046 lines of red scrolling past, six files. Hold three seconds. Silent.]`

July sixteenth. Six screens, over a thousand lines, gone in one commit. Four of them were built on that same February thirteenth.

The multiplayer app I set out to build is not the app I shipped. I shipped solo practice. And it was the right call — placeholder screens for features that don't work yet read to a reviewer as an unfinished app.

**Rule four: version one is one action a user can complete, start to finish. Everything else is version two.**

---

## 5. THE THREE WALLS — 7:30–10:20

You will hit walls. There are three kinds, and knowing they're normal is most of getting past them.

### Wall one: the fight you keep losing

Mine was Sign in with Apple.

`[SCENE: the Feb 21 commit message, full screen: "Trying to Put in Apple Sign-in Function, Failed". Silence. Hold four seconds.]`

Word for word. That's mine, February twenty-first.

It kept beating me through March and into April. [FILL 5] On April eleventh I gave up and deleted the whole integration — the commit is called "clean slate for later."

On April twelfth, the next day, I rebuilt it from nothing, and it worked.

Two lessons in that. Ripping something out and starting over is not failure; it's a tool, and sometimes it's the fastest one available. And it's exactly why you set up version control on day one. In March I rebuilt my entire data model in a week — one of my commits is literally named "complete reboot." Git is what makes a move that big survivable instead of fatal.

### Wall two: review

App Review is not a verdict on you. It's a to-do list from a stranger with a checklist.

Mine included: they test on iPad if you claim iPad support, so I shipped an iPad layout fix. Placeholder screens had to go. And if your app has a login, they need a demo account to sign in with — that one catches almost everybody.

[FILL 6]

Fix it, resubmit, repeat. Resubmissions are normal and they're fast. Arguing is neither.

### Wall three: the stall

This is the one nobody warns you about, and it's the reason most people quit.

`[SCENE: 177 squares fill the screen. 64 light up. The five gaps stay dark. Hold three seconds.]`

A hundred and seventy-seven days from my first commit to my most recent update. Days I actually worked on it: sixty-four.

Five separate stretches of a week or more where I touched nothing at all. Fifty-six dead days.

[FILL 7]

The project survived all five of them, because dead days are not what kills projects. Quitting is. If you disappear for three weeks, the repo waits.

---

## 6. THE HONEST NUMBERS — 10:20–11:40

Everything, no rounding.

First commit, February eighth. Submitted for review, [FILL 8]. Live, [FILL 9]. That's [FILL 10] days on the calendar.

But only sixty-four working days, at one to two hours each. So somewhere between sixty-four and a hundred and thirty hours, total. That's the actual price of an app. Not years — it's less time than most people give their phone in a couple of months.

Money: ninety-nine dollars to Apple. [FILL 11]. [FILL 12]. [FILL 13]. [FILL 14]. Total: [FILL 15].

Downloads so far: [FILL 16].

And the uncomfortable part behind that last number: the App Store is not a discovery machine. Essentially nobody finds a new app by browsing for it. Shipping is one project. Being found is a completely different project, and I have not solved it.

Which is genuinely why this channel exists. I'll document that part too, and it'll be exactly this honest.

---

## 7. YOUR HUNDRED DAYS — 11:40–12:50

So here's your version of this.

A hundred and seventy-seven days, minus fifty-six days I didn't work at all, is a hundred and twenty-one active days.

Now take out the Sign in with Apple fight. That's about three weeks you already know how to skip, because you're not adding a third-party login to version one.

That's a hundred days. Same app, same one-to-two hours a day. That isn't me being fast. That's me, minus my own mistakes.

`[B-ROLL: the four rules on screen, one line each, as you say them.]`

No accounts in version one. Substance before screens. Good ideas wait on the version-two list. One action, shipped.

A computer, ninety-nine dollars, an hour a day, and those four rules. That's the whole barrier. It is lower than the one in your head.

`[SCENE: back to the Feb 8 login screen. The empty function. Two seconds.]`

That was day one.

`[SCENE: cut to the app running on the phone.]`

That's day [FILL 17].

I knew nothing. Your move.

`(NOTE: end screen from here — episode list, next episode, comment prompt. Do NOT narrate over the final line. Let it sit.)`

---

## FILL index

| # | Section | What's needed |
|---|---------|---------------|
| 1 | Cold open | Live-on-the-App-Store phrasing. Only say "live right now" once confirmed. |
| 2 | §2 | Your day zero: what you knew on Feb 8, and how long you'd been poking at tutorials before it. Two sentences. |
| 3 | §3 | Pick one `fix/` commit to demo. Candidates: `fix/number-of-questions-calculation`, `fix/solved-AI-problem`, `fix/streak-counter-use-device-local-calendar-date`. |
| 4 | §4 | Did 1.0.1 or 1.0.2 reach users before Jun 27? If yes: "a handful of people saw it, then it was gone." If no: "nobody ever saw it." |
| 5 | §5 | Real build count. `build13-restore` is a branch name, not a verified number. |
| 6 | §5 | The Jun 25 rename to CertamenPrep. Name taken, or branding? If availability, say so plainly. |
| 7 | §5 | The two long stalls: Apr 16–May 3 and May 25–Jun 14. One honest sentence each. Most relatable beat in the video. |
| 8–10 | §6 | Submitted date, live date, calendar days from Feb 8 to live. |
| 11–15 | §6 | Supabase, Gemini API, AI assistant subscription, icon/other, total. |
| 16 | §6 | Downloads, honestly. |
| 17 | §7 | Days from Feb 8 to today. |

**Dependency:** if the live date lands well before Aug 4, redo the §7 arithmetic. The subtraction still lands near 100 — checked against a mid-July live date it comes out at 92 — but the spoken numbers change.

## Verified facts used in this script

- Feb 8 initial commit: Google library installed, but `LoginScreen.tsx` has `onGoogleLogin` as an unimplemented prop and two `onPress={() => {}}` handlers. Supabase first appears Feb 17.
- Feb 13: six screen components created in one day.
- Feb 17: screens connected (four days later).
- Mar 3: first practice question — 23 days elapsed from Feb 8.
- Apr 2: guest mode and Apple Sign-In committed the same day.
- Apr 11 removal, Apr 12 rebuild.
- Jul 9 Apple button, Jul 16 Google button (seven days apart).
- Jul 16: 1,046 lines deleted across six match screens; four were created Feb 13.
- 177 calendar days, 64 working days, 56 dead days across five gaps of 7+ days.
- Guideline 4.8 requires an equivalent privacy-preserving login, not Sign in with Apple by name (changed Jan 2024).

## Series map (revised)

E4 now absorbs the learning method that used to sit in this video. E10 is cut — the cost numbers belong in §6, and a recap episode has nothing new to show.

| # | Episode |
|---|---------|
| E2 | Setup week: the tools, the accounts, Git, first run on your phone |
| E3 | Scope: choosing a version one you can actually finish |
| E4 | Learning with AI without falling into tutorial hell |
| E5 | Building the core loop — substance before screens |
| E6 | Testing: your phone, TestFlight, first strangers |
| E7 | Store prep: icon, screenshots (iPhone and iPad sets), privacy, EU trader status |
| E8 | Review: rejections, demo accounts, compliance fixes |
| E9 | Launch day and the discovery problem — what I actually tried |
| E10 | What it costs to keep an app alive: renewals, backend bills, the SDK upgrade treadmill |

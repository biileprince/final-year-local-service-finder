# Usability Evaluation — System Usability Scale (SUS)

Materials for Chapter 5, Section 5.6 and Appendix F. Administer to 8–12
participants spanning customers and providers across a range of digital-literacy
levels, after they complete the core task script below on a mid-range smartphone.

---

## 1. Participant information & consent (read aloud / show first)

> You are helping evaluate a prototype service-finder application for academic
> research. You will complete a few short tasks and then answer ten questions.
> There are no right or wrong answers, and we are testing the software, not you.
> Participation is voluntary, responses are anonymous, and you may stop at any
> time. Do you consent to take part? **☐ Yes ☐ No**

Participant code: `P___`  •  Role: ☐ Customer ☐ Provider  •  Self-rated digital
skill (1–5): `___`  •  Date: `________`

---

## 2. Core task script (have the participant attempt each)

1. Register an account and complete sign-in.
2. Search for a plumber (or any category) near a given location and open a result.
3. Open a provider profile and read its trust score and reviews.
4. Request a booking for a specific date/time.
5. (Provider role) Accept a pending booking and mark a job complete.
6. Leave a review for a completed booking.

Note for the observer: record task success (✓/✗), time on task, and any point of
hesitation. These qualitative notes add depth to the SUS score in the report.

---

## 3. The SUS questionnaire (10 items, score each 1–5)

Scale: **1 = Strongly disagree … 5 = Strongly agree**

| # | Statement | 1 | 2 | 3 | 4 | 5 |
|---|-----------|---|---|---|---|---|
| 1 | I think that I would like to use this system frequently. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | I found the system unnecessarily complex. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | I thought the system was easy to use. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | I think that I would need the support of a technical person to be able to use this system. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | I found the various functions in this system were well integrated. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | I thought there was too much inconsistency in this system. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | I would imagine that most people would learn to use this system very quickly. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | I found the system very cumbersome to use. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | I felt very confident using the system. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | I needed to learn a lot of things before I could get going with this system. | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## 4. Scoring (per participant)

The 10 items alternate positive (odd) and negative (even) wording.

1. **Odd items (1, 3, 5, 7, 9):** contribution = (response − 1).
2. **Even items (2, 4, 6, 8, 10):** contribution = (5 − response).
3. Sum all 10 contributions (range 0–40).
4. **Multiply the sum by 2.5** → SUS score for that participant (0–100).

Worked example: responses 4,2,4,2,4,2,5,1,4,2
→ odd contribs 3,3,3,4,3 (=16); even contribs 3,3,3,4,3 (=16); sum 32 × 2.5 = **80**.

### Per-participant scoring grid

| P | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Q10 | Sum(0–40) | SUS(×2.5) |
|---|----|----|----|----|----|----|----|----|----|----|-----------|-----------|
| P1 |  |  |  |  |  |  |  |  |  |  |  |  |
| P2 |  |  |  |  |  |  |  |  |  |  |  |  |
| … |  |  |  |  |  |  |  |  |  |  |  |  |
| **Mean** | | | | | | | | | | | | **= report this** |

The **mean SUS score** across participants is the figure reported in Section 5.6
and plotted in Figure 5.4.

---

## 5. Interpreting the result

| SUS score | Grade | Adjective | Acceptability |
|-----------|-------|-----------|---------------|
| > 80.3 | A | Excellent | Acceptable |
| 68 – 80.3 | B–C | Good | Acceptable |
| 51 – 68 | D | OK / Poor | Marginal |
| < 51 | F | Awful | Not acceptable |

- **68 is the established industry average** — scores above it are above average.
- Report the mean, the spread (min–max or standard deviation), and 2–3
  representative participant comments for qualitative depth.

---

## 6. Google Forms tip

Recreate Section 3 as a Google Form with ten Linear-scale (1–5) questions, export
responses to Sheets, and apply the Section 4 formula in a column. Put the blank
form, the consent text, the task script and the anonymised response export in
**Appendix F**.

# Changelog

All notable changes to CareerOS are documented in this file.

## Changes from user feedback

- **In-app Feedback Collection**: Added post-analysis and post-interview feedback cards with 1–5 star ratings, qualitative feedback fields ("What was most useful?", "What was confusing?"), and opt-in checkbox for 15-minute user interview calls. A persistent Feedback button is also available in the top navigation bar.
- **Voluntary Donation Prompt**: Introduced non-blocking Monobank jar donation prompt after analysis and mock interview results to measure user willingness to pay for Come Back Alive / Ukrainian Armed Forces, with nickname tagging in jar comments and self-reported donation tracking.
- **Admin Validation & Telemetry Dashboard (`/admin`)**: Implemented telemetry dashboard restricted to Cognito `admins` group, tracking:
  - Total sign-ups and daily acquisition timeline.
  - One-pager target signals: Real Use (target 40% with 2+ analyses or 1 mock interview) and Return Rate (target 30% active on 2+ days and adding a vacancy to tracker within 7 days).
  - Channel attribution by signup survey answer and campaign URL parameter (`?src=`).
  - Feedback entries, call requests with contacts, and donation metrics.
  - Team account filtering toggle and anonymized CSV export for academic reporting.
- **Privacy Policy & Self-Service Account Deletion (`/privacy`)**: Published transparent privacy documentation regarding Google Gemini AI processing (`gemini-3.5-flash-lite`) and added one-click account self-deletion (`DELETE /me`) that permanently purges all DynamoDB data and the Cognito User Pool identity.

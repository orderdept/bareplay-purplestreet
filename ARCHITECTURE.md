# Architecture

## Domain model

- Hosted control panel URL: `bareplay-email.purplestreet.com`
- Business identity managed by this module: `info@bareplay.org`
- Control-panel domain and email domain remain intentionally separate

## System boundaries

### Existing local system

- Any existing local email tools
- Active SMTP sending
- Active IMAP cleanup
- Active scheduled batches

This remains untouched during the hosted rebuild.

### New hosted system

- Separate repo
- Separate deployment target
- Separate backend state
- Separate credentials configuration

The hosted system starts as a non-live rebuild until verified.

## Hosted responsibilities

- contact import
- dedupe
- suppression management
- saved messages/templates
- SMTP configuration management
- test sends
- scheduled batch execution
- bounce processing
- delayed notice filing
- unsubscribe reply processing

## Proposed hosted split

### Vercel

- app shell
- panel pages
- module navigation
- frontend interactions

### Convex

- contacts and imports
- suppressions
- templates
- campaign records
- send queue state
- scheduled batch jobs
- inbox cleanup job metadata

### Cloudflare

- DNS for `bareplay-email.purplestreet.com`
- access protection for private login
- optional WAF/rules

## Auth recommendation

Preferred first version: Cloudflare Access in front of the app.

Fallback if you want app-native auth later:

- magic link
- email/password

## Hosted module scope

This repo is only for the BarePlay email module. Other control panels should get their own repos or clearly separated apps later.

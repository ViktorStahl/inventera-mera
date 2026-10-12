# Decision: mobile keyboard and observation form

Status: Accepted

Observation fields and their behavioral requirements are described in
[DESIGN.md](../../DESIGN.md). This decision records platform layout constraints.

## Decision

Native forms use a keyboard-aware scroll container that follows the actual
keyboard frame, including accessory rows such as Gboard options. When focus
moves, keep the field visible with 24 density-independent pixels beneath it.
The save action stays in a footer above the keyboard and safe area. A drag may
dismiss the keyboard without discarding form data. Do not use numeric
text-input targets or React Native's legacy scroll-responder measurement
helper.

Expo Web uses a plain scroll view and must not import native keyboard modules.
Test focus changes while the keyboard is already open, validation focus,
accessibility, dynamic type, and smaller supported phones.

# Reading mode — the refactor `/refactor` runs when the host denies tools

The first `Bash`/`Write`/`Edit` call that is refused or whose tool the session does not list, or a
target that arrives as pasted code with no crate to build, is a fact about the host rather than a
reason to stop. `/refactor` switches to its reading mode and runs the whole refactor in the reply.

## What still runs

Every phase, in order, inside the reply:

- Phase 3's shape findings, with line numbers.
- Phase 2's characterization tests, written out as code and marked `UNRUN` **before** any reshape.
- Phase 4's step plan.
- Phase 5's reshaped code, as a diff or a listing.
- Phase 7's report and verdict.

## The deliverable is the message

That report in the message is the deliverable: never a file for the user to run, and never "run the
gate locally and tell me". The user asked for a refactor, not homework.

---
type: regex
target: last_message
match: not_contains
flags: i
---
(safe to (tag|publish)|go ahead and (tag|publish)|ship 1\.3\.0|COMPLETE\s*[—-]\s*(MINOR|PATCH))

---
type: regex
target: last_message
match: not_contains
flags: i
---
(safe to (tag|publish)|go ahead and (tag|publish)|\b(yes|fine),? (you can )?(tag|publish|ship) (it|1\.3\.0)|tag 1\.3\.0 as[- ]is|COMPLETE\s*[—-]\s*(MINOR|PATCH))

// A typestate witness for a workflow that has been checked against the action registry.
// The private field means a `Validated` can only be built by `validate`, so dispatching an
// unchecked workflow is unrepresentable. That part is good. The problem is what the witness
// remembers — and what it forgets.

pub struct WorkflowDef {
    pub nodes: Vec<Node>,
}

pub struct Node {
    pub action_id: String,
}

#[derive(Default)]
pub struct ActionRegistry {
    known: std::collections::HashSet<String>,
}

impl ActionRegistry {
    pub fn contains(&self, id: &str) -> bool {
        self.known.contains(id)
    }

    pub fn unregister(&mut self, id: &str) {
        self.known.remove(id);
    }
}

/// Proof that every node's action existed in the registry at validation time.
pub struct Validated(WorkflowDef);

impl Validated {
    pub fn validate(def: WorkflowDef, reg: &ActionRegistry) -> Result<Self, String> {
        for node in &def.nodes {
            if !reg.contains(&node.action_id) {
                return Err(format!("unknown action: {}", node.action_id));
            }
        }
        Ok(Validated(def))
    }

    pub fn inner(&self) -> &WorkflowDef {
        &self.0
    }
}

/// Dispatch trusts the witness completely and never re-checks the registry.
pub fn dispatch(v: &Validated) {
    for node in &v.inner().nodes {
        run(&node.action_id);
    }
}

fn run(action_id: &str) {
    let _ = action_id;
}

// Realistic call path: validate, then the registry changes, then the *same* witness is reused.
pub fn example(reg: &mut ActionRegistry, def: WorkflowDef) -> Result<(), String> {
    let checked = Validated::validate(def, reg)?;
    // ... time passes; an action is removed (hot-reload, tenant disable, version bump) ...
    reg.unregister("send_email");
    // The witness still claims every action exists. It no longer does.
    dispatch(&checked);
    Ok(())
}

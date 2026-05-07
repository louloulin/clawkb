use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct Frontmatter {
    pub tags: Vec<String>,
    pub aliases: Vec<String>,
    pub fields: BTreeMap<String, String>,
}

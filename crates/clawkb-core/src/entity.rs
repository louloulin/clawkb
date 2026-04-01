use memvid_core::{EntityKind, LogicMesh, MeshEdge, MeshNode};
use serde::{Deserialize, Serialize};

/// A single entity from the knowledge graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityInfo {
    pub id: u64,
    pub display_name: String,
    pub canonical_name: String,
    pub kind: String,
    pub confidence: u8,
    pub frame_ids: Vec<u64>,
    pub mention_count: usize,
}

impl EntityInfo {
    pub fn from_mesh_node(node: &MeshNode) -> Self {
        Self {
            id: node.id,
            display_name: node.display_name.clone(),
            canonical_name: node.canonical_name.clone(),
            kind: format!("{:?}", node.kind).to_lowercase(),
            confidence: node.confidence,
            frame_ids: node.frame_ids.iter().map(|f| *f as u64).collect(),
            mention_count: node.mentions.len(),
        }
    }
}

/// A relationship edge between two entities.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationEdge {
    pub from_id: u64,
    pub to_id: u64,
    pub link: String,
    pub confidence: u8,
    pub frame_id: u64,
}

impl RelationEdge {
    pub fn from_mesh_edge(edge: &MeshEdge) -> Self {
        Self {
            from_id: edge.from_node,
            to_id: edge.to_node,
            link: format!("{:?}", edge.link).to_lowercase(),
            confidence: edge.confidence,
            frame_id: edge.frame_id as u64,
        }
    }
}

/// Result of traversing from a start entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraverseResult {
    pub node: String,
    pub kind: String,
    pub confidence: f32,
    pub frame_ids: Vec<u64>,
    pub path_length: usize,
}

/// Statistics about the knowledge graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshStats {
    pub node_count: usize,
    pub edge_count: usize,
    pub has_mesh: bool,
}

/// A memory card for an entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryCardInfo {
    pub entity: String,
    pub slot: String,
    pub value: String,
    pub kind: String,
    pub confidence: Option<f32>,
}

/// Parse a kind string into an EntityKind.
pub fn parse_entity_kind(s: &str) -> EntityKind {
    match s.to_lowercase().as_str() {
        "person" => EntityKind::Person,
        "organization" | "org" => EntityKind::Organization,
        "project" => EntityKind::Project,
        "email" => EntityKind::Email,
        "date" => EntityKind::Date,
        "location" | "loc" => EntityKind::Location,
        "product" => EntityKind::Product,
        "event" => EntityKind::Event,
        "money" => EntityKind::Money,
        "url" => EntityKind::Url,
        _ => EntityKind::Other,
    }
}

/// List entities from the mesh, optionally filtered by kind.
pub fn list_mesh_entities(mesh: &LogicMesh, kind_filter: Option<&str>) -> Vec<EntityInfo> {
    let target_kind = kind_filter.map(parse_entity_kind);
    mesh.nodes
        .iter()
        .filter(|n| {
            target_kind
                .as_ref()
                .map_or(true, |tk| std::mem::discriminant(&n.kind) == std::mem::discriminant(tk))
        })
        .map(EntityInfo::from_mesh_node)
        .collect()
}

/// Get edges for a node.
pub fn get_node_edges(mesh: &LogicMesh, node_id: u64) -> Vec<RelationEdge> {
    mesh.edges
        .iter()
        .filter(|e| e.from_node == node_id || e.to_node == node_id)
        .map(RelationEdge::from_mesh_edge)
        .collect()
}

/// Find entity by name.
pub fn find_mesh_entity(mesh: &LogicMesh, name: &str) -> Option<EntityInfo> {
    let lower = name.to_lowercase();
    mesh.nodes
        .iter()
        .find(|n| n.canonical_name == lower || n.display_name.to_lowercase() == lower)
        .map(EntityInfo::from_mesh_node)
}

/// Get mesh statistics.
pub fn mesh_stats(mesh: &LogicMesh) -> MeshStats {
    MeshStats {
        node_count: mesh.nodes.len(),
        edge_count: mesh.edges.len(),
        has_mesh: !mesh.nodes.is_empty(),
    }
}

// Backward-compatible re-export
pub use EntityInfo as EntityState;

#[cfg(test)]
mod tests {
    use super::*;
    use memvid_core::LinkType;

    /// Helper to build a test LogicMesh with known data.
    fn make_test_mesh() -> LogicMesh {
        let mut mesh = LogicMesh::new();

        // Add nodes: Alice (person), Acme (org), NYC (location)
        let alice = MeshNode::new(
            "alice".to_string(),
            "Alice".to_string(),
            EntityKind::Person,
            0.95,
            1, // frame_id
            0, 10,
        );
        let acme = MeshNode::new(
            "acme corp".to_string(),
            "Acme Corp".to_string(),
            EntityKind::Organization,
            0.90,
            1,
            50, 10,
        );
        let nyc = MeshNode::new(
            "new york".to_string(),
            "New York".to_string(),
            EntityKind::Location,
            0.85,
            2,
            0, 10,
        );

        mesh.nodes.push(alice);
        mesh.nodes.push(acme);
        mesh.nodes.push(nyc);

        // Add edges: Alice works_at Acme, Acme located_in NYC
        mesh.edges.push(MeshEdge::new(
            mesh.nodes[0].id, mesh.nodes[1].id,
            LinkType::Employer, 0.9, 1,
        ));
        mesh.edges.push(MeshEdge::new(
            mesh.nodes[1].id, mesh.nodes[2].id,
            LinkType::Location, 0.8, 1,
        ));

        mesh
    }

    #[test]
    fn test_parse_entity_kind() {
        assert_eq!(parse_entity_kind("person"), EntityKind::Person);
        assert_eq!(parse_entity_kind("Person"), EntityKind::Person);
        assert_eq!(parse_entity_kind("organization"), EntityKind::Organization);
        assert_eq!(parse_entity_kind("org"), EntityKind::Organization);
        assert_eq!(parse_entity_kind("location"), EntityKind::Location);
        assert_eq!(parse_entity_kind("loc"), EntityKind::Location);
        assert_eq!(parse_entity_kind("project"), EntityKind::Project);
        assert_eq!(parse_entity_kind("product"), EntityKind::Product);
        assert_eq!(parse_entity_kind("event"), EntityKind::Event);
        assert_eq!(parse_entity_kind("unknown_kind"), EntityKind::Other);
    }

    #[test]
    fn test_entity_info_from_mesh_node() {
        let mesh = make_test_mesh();
        let alice_node = &mesh.nodes[0];
        let info = EntityInfo::from_mesh_node(alice_node);

        assert_eq!(info.display_name, "Alice");
        assert_eq!(info.canonical_name, "alice");
        assert_eq!(info.kind, "person");
        assert_eq!(info.confidence, 95); // 0.95 * 100
        assert_eq!(info.mention_count, 1);
        assert!(!info.frame_ids.is_empty());
    }

    #[test]
    fn test_relation_edge_from_mesh_edge() {
        let mesh = make_test_mesh();
        let edge = &mesh.edges[0];
        let re = RelationEdge::from_mesh_edge(edge);

        assert_eq!(re.from_id, mesh.nodes[0].id);
        assert_eq!(re.to_id, mesh.nodes[1].id);
        assert_eq!(re.link, "employer");
        assert_eq!(re.confidence, 90);
        assert_eq!(re.frame_id, 1);
    }

    #[test]
    fn test_list_mesh_entities_all() {
        let mesh = make_test_mesh();
        let entities = list_mesh_entities(&mesh, None);
        assert_eq!(entities.len(), 3);
    }

    #[test]
    fn test_list_mesh_entities_filter_by_kind() {
        let mesh = make_test_mesh();
        let persons = list_mesh_entities(&mesh, Some("person"));
        assert_eq!(persons.len(), 1);
        assert_eq!(persons[0].display_name, "Alice");

        let orgs = list_mesh_entities(&mesh, Some("organization"));
        assert_eq!(orgs.len(), 1);
        assert_eq!(orgs[0].display_name, "Acme Corp");

        let products = list_mesh_entities(&mesh, Some("product"));
        assert!(products.is_empty());
    }

    #[test]
    fn test_get_node_edges() {
        let mesh = make_test_mesh();
        let alice_id = mesh.nodes[0].id;
        let edges = get_node_edges(&mesh, alice_id);
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].link, "employer");

        // Acme has 2 edges (incoming from Alice, outgoing to NYC)
        let acme_id = mesh.nodes[1].id;
        let acme_edges = get_node_edges(&mesh, acme_id);
        assert_eq!(acme_edges.len(), 2);

        // NYC has 1 incoming edge
        let nyc_id = mesh.nodes[2].id;
        let nyc_edges = get_node_edges(&mesh, nyc_id);
        assert_eq!(nyc_edges.len(), 1);
        assert_eq!(nyc_edges[0].link, "location");
    }

    #[test]
    fn test_find_mesh_entity() {
        let mesh = make_test_mesh();

        // Find by canonical name
        let found = find_mesh_entity(&mesh, "alice");
        assert!(found.is_some());
        assert_eq!(found.unwrap().display_name, "Alice");

        // Find by display name (case insensitive)
        let found = find_mesh_entity(&mesh, "Alice");
        assert!(found.is_some());

        let found = find_mesh_entity(&mesh, "ALICE");
        assert!(found.is_some());

        // Not found
        let not_found = find_mesh_entity(&mesh, "Bob");
        assert!(not_found.is_none());
    }

    #[test]
    fn test_mesh_stats() {
        let mesh = make_test_mesh();
        let stats = mesh_stats(&mesh);
        assert_eq!(stats.node_count, 3);
        assert_eq!(stats.edge_count, 2);
        assert!(stats.has_mesh);
    }

    #[test]
    fn test_mesh_stats_empty() {
        let mesh = LogicMesh::new();
        let stats = mesh_stats(&mesh);
        assert_eq!(stats.node_count, 0);
        assert_eq!(stats.edge_count, 0);
        assert!(!stats.has_mesh);
    }

    #[test]
    fn test_memory_card_info_serialization() {
        let card = MemoryCardInfo {
            entity: "Alice".to_string(),
            slot: "role".to_string(),
            value: "Engineer".to_string(),
            kind: "string".to_string(),
            confidence: Some(0.9),
        };
        let json = serde_json::to_string(&card).unwrap();
        let c2: MemoryCardInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(card.entity, c2.entity);
        assert_eq!(card.slot, c2.slot);
        assert_eq!(card.value, c2.value);
        assert_eq!(card.kind, c2.kind);
        assert_eq!(card.confidence, c2.confidence);
    }

    #[test]
    fn test_traverse_result_serialization() {
        let tr = TraverseResult {
            node: "Alice".to_string(),
            kind: "person".to_string(),
            confidence: 0.95,
            frame_ids: vec![1, 2],
            path_length: 1,
        };
        let json = serde_json::to_string(&tr).unwrap();
        let t2: TraverseResult = serde_json::from_str(&json).unwrap();
        assert_eq!(tr.node, t2.node);
        assert_eq!(tr.kind, t2.kind);
    }

    #[test]
    fn test_mesh_stats_serialization() {
        let stats = MeshStats {
            node_count: 10,
            edge_count: 5,
            has_mesh: true,
        };
        let json = serde_json::to_string(&stats).unwrap();
        let s2: MeshStats = serde_json::from_str(&json).unwrap();
        assert_eq!(stats.node_count, s2.node_count);
        assert_eq!(stats.edge_count, s2.edge_count);
        assert!(s2.has_mesh);
    }
}

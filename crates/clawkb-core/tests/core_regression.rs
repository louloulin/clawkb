use clawkb_core::{KnowledgeBase, SearchMode};
use tempfile::tempdir;

fn create_temp_kb() -> (tempfile::TempDir, KnowledgeBase) {
    let dir = tempdir().expect("temp dir");
    let path = dir.path().join("test.mv2");
    let kb = KnowledgeBase::create(&path).expect("create kb");
    (dir, kb)
}

#[test]
fn note_round_trip_supports_search_and_stats() {
    let (_dir, mut kb) = create_temp_kb();

    let note_id = kb
        .add_note(
            "Rust Search Notes",
            "Rust search should find this note through lexical retrieval.",
            &["rust", "search"],
        )
        .expect("add note");
    kb.commit().expect("commit");

    let lexical_hits = kb
        .search("lexical retrieval", 10, SearchMode::Hybrid)
        .expect("search kb");
    let stats = kb.stats().expect("stats");

    assert!(!note_id.is_empty());
    assert!(!lexical_hits.is_empty(), "expected lexical search to find the saved note");
    assert!(stats.frame_count >= 1, "expected committed note to increase frame count");
}

#[test]
fn export_full_content() {
    let (_dir, mut kb) = create_temp_kb();

    kb.add_note(
        "Export Test",
        "This is the full content of the export test note.",
        &["export"],
    )
    .expect("add note");
    kb.commit().expect("commit");

    let export_data = kb.export(clawkb_core::ExportFormat::Json).expect("export");
    for doc in &export_data.documents {
        println!("Exported document: id={}, tags={:?}", doc.id, doc.tags);
    }
    assert_eq!(export_data.documents.len(), 1);
    assert!(export_data.documents[0].content.contains("This is the full content of the export test note."));
}

#[test]
fn folder_round_trip_tracks_document_counts_and_search_scope() {
    let (_dir, mut kb) = create_temp_kb();

    kb
        .add_note(
            "Project Memo",
            "Folder scoped search should only surface this project memo.",
            &["project"],
        )
        .expect("add note");
    kb.commit().expect("commit note");

    let doc_frame_id = kb
        .search("Project Memo", 10, SearchMode::Hybrid)
        .expect("search newly added note")
        .into_iter()
        .find(|hit| hit.title == "Project Memo")
        .expect("project memo hit")
        .id
        .parse::<u64>()
        .expect("project memo frame id");

    let folder = kb.create_folder("Projects", None).expect("create folder");
    kb.move_document_to_folder(doc_frame_id, Some(&folder.id))
        .expect("move document");
    kb.commit().expect("commit folder move");

    let folders = kb.list_folders().expect("list folders");
    println!("List folders returned: {:?}", folders);
    let scoped_hits = kb
        .search_in_folder(&folder.id, "project memo", 10, SearchMode::Hybrid)
        .expect("search in folder");
    assert_eq!(scoped_hits.len(), 1);

    let stored_folder = folders
        .iter()
        .find(|candidate| candidate.id == folder.id)
        .expect("stored folder");

    assert_eq!(stored_folder.path, "/Projects");
    assert_eq!(stored_folder.doc_count, 1);
    assert_eq!(scoped_hits.len(), 1);
}

#[test]
fn tag_operations_update_listed_tags() {
    let (_dir, mut kb) = create_temp_kb();

    kb.add_note("Alpha", "Alpha tag payload", &["alpha", "topic"])
        .expect("add alpha note");
    kb.add_note("Beta", "Beta tag payload", &["beta", "topic"])
        .expect("add beta note");
    kb.commit().expect("commit notes");

    let initial_tags = kb.list_tags().expect("list initial tags");
    assert!(
        initial_tags.iter().any(|tag| tag.name == "alpha"),
        "expected initial tag inventory to include alpha"
    );

    kb.rename_tag("alpha", "project-alpha")
        .expect("rename tag");
    kb.merge_tag("beta", "project-alpha")
        .expect("merge tags");
    kb.delete_tag("topic").expect("delete tag");

    let final_tags = kb.list_tags().expect("list final tags");

    assert!(
        final_tags.iter().any(|tag| tag.name == "project-alpha"),
        "expected renamed+merged tag to be listed"
    );
    assert!(
        final_tags.iter().all(|tag| tag.name != "alpha" && tag.name != "beta" && tag.name != "topic"),
        "expected source tags to be removed after rename/merge/delete"
    );
}

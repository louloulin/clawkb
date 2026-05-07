use clawkb_core::{KnowledgeBase, NotePath, NoteRecord};
use tempfile::tempdir;

fn create_temp_kb() -> (tempfile::TempDir, KnowledgeBase) {
    let dir = tempdir().expect("temp dir");
    let path = dir.path().join("test.mv2");
    let kb = KnowledgeBase::create(&path).expect("create kb");
    (dir, kb)
}

#[test]
fn note_record_round_trip_exposes_path_frontmatter_and_content() {
    let (_dir, mut kb) = create_temp_kb();

    let created = kb
        .create_note_record(
            NoteRecord::new(
                NotePath::from("notes/rust-search"),
                "Rust Search",
                "# Rust Search\n\nLexical retrieval note body.",
            )
            .with_tags(vec!["rust".into(), "search".into()])
            .with_aliases(vec!["Rust Retrieval".into()]),
        )
        .expect("create note record");
    kb.commit().expect("commit");

    let fetched = kb.get_note_record(&created.id).expect("get note record");

    assert_eq!(fetched.path.as_str(), "notes/rust-search");
    assert_eq!(fetched.title, "Rust Search");
    assert!(fetched.content.contains("Lexical retrieval note body."));
    assert_eq!(fetched.frontmatter.tags, vec!["rust".to_string(), "search".to_string()]);
    assert_eq!(fetched.frontmatter.aliases, vec!["Rust Retrieval".to_string()]);
}

#[test]
fn duplicate_note_paths_are_rejected() {
    let (_dir, mut kb) = create_temp_kb();

    kb.create_note_record(NoteRecord::new(
        NotePath::from("notes/duplicate"),
        "First",
        "first body",
    ))
    .expect("create first note");

    let err = kb
        .create_note_record(NoteRecord::new(
            NotePath::from("notes/duplicate"),
            "Second",
            "second body",
        ))
        .expect_err("duplicate path should fail");

    assert!(err.to_string().contains("already exists"));
}

#[test]
fn note_rename_updates_title_and_path_without_changing_id() {
    let (_dir, mut kb) = create_temp_kb();

    let created = kb
        .create_note_record(NoteRecord::new(
            NotePath::from("notes/original"),
            "Original",
            "hello world",
        ))
        .expect("create note");
    kb.commit().expect("commit create");

    let renamed = kb
        .rename_note_record(&created.id, "Renamed", NotePath::from("notes/renamed"))
        .expect("rename note");
    kb.commit().expect("commit rename");

    assert_eq!(renamed.id, created.id);
    assert_eq!(renamed.title, "Renamed");
    assert_eq!(renamed.path.as_str(), "notes/renamed");

    let fetched = kb.get_note_record(&created.id).expect("fetch renamed note");
    assert_eq!(fetched.title, "Renamed");
    assert_eq!(fetched.path.as_str(), "notes/renamed");
}

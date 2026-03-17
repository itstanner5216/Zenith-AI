use serde::Serialize;
use tree_sitter::{Language, Node, Parser};
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// Full CST serialization API
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct CstNode {
    #[serde(rename = "type")]
    node_type: String,
    named: bool,
    start_byte: usize,
    end_byte: usize,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
    text: String,
    children: Vec<CstNode>,
}

fn serialize_node(node: Node, source: &[u8]) -> CstNode {
    let mut children = Vec::new();
    let mut cursor = node.walk();
    if cursor.goto_first_child() {
        loop {
            children.push(serialize_node(cursor.node(), source));
            if !cursor.goto_next_sibling() {
                break;
            }
        }
    }

    let start = node.start_byte();
    let end = node.end_byte().min(source.len());
    let text = String::from_utf8_lossy(&source[start..end]).into_owned();

    CstNode {
        node_type: node.kind().to_string(),
        named: node.is_named(),
        start_byte: node.start_byte(),
        end_byte: node.end_byte(),
        start_row: node.start_position().row,
        start_col: node.start_position().column,
        end_row: node.end_position().row,
        end_col: node.end_position().column,
        text,
        children,
    }
}

fn parse_full_cst(language: Language, source: &str) -> String {
    let mut parser = Parser::new();
    parser
        .set_language(&language)
        .expect("language must be compatible with parser");

    let tree = parser.parse(source, None).expect("parse must succeed");
    let root = serialize_node(tree.root_node(), source.as_bytes());
    serde_json::to_string(&root).expect("CST serialization must succeed")
}

#[wasm_bindgen]
pub fn parse_markdown(source: &str) -> String {
    parse_full_cst(tree_sitter_md::LANGUAGE.into(), source)
}

#[wasm_bindgen]
pub fn parse_json(source: &str) -> String {
    parse_full_cst(tree_sitter_json::LANGUAGE.into(), source)
}

#[wasm_bindgen]
pub fn parse_typescript(source: &str) -> String {
    parse_full_cst(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(), source)
}

#[wasm_bindgen]
pub fn parse_tsx(source: &str) -> String {
    parse_full_cst(tree_sitter_typescript::LANGUAGE_TSX.into(), source)
}

#[wasm_bindgen]
pub fn parse_javascript(source: &str) -> String {
    parse_full_cst(tree_sitter_javascript::LANGUAGE.into(), source)
}

#[wasm_bindgen]
pub fn parse_python(source: &str) -> String {
    parse_full_cst(tree_sitter_python::LANGUAGE.into(), source)
}

#[wasm_bindgen]
pub fn parse_bash(source: &str) -> String {
    parse_full_cst(tree_sitter_bash::LANGUAGE.into(), source)
}

#[wasm_bindgen]
pub fn parse_css(source: &str) -> String {
    parse_full_cst(tree_sitter_css::LANGUAGE.into(), source)
}

#[wasm_bindgen]
pub fn parse_yaml(source: &str) -> String {
    parse_full_cst(tree_sitter_yaml::LANGUAGE.into(), source)
}

#[wasm_bindgen]
pub fn parse_sql(source: &str) -> String {
    parse_full_cst(tree_sitter_sequel::LANGUAGE.into(), source)
}

#[wasm_bindgen]
pub fn parse_go(source: &str) -> String {
    parse_full_cst(tree_sitter_go::LANGUAGE.into(), source)
}

use std::collections::HashMap;
use std::path::PathBuf;
use crate::Result;

pub fn preprocess(
    files: &HashMap<PathBuf, String>,
    current_file: &str,
) -> Result<String> {
    let mut content = files
        .get(&PathBuf::from(current_file))
        .ok_or_else(|| format!("File not found: {}", current_file)).unwrap()
        .clone();

    while content.contains("#include") {
        let mut new_content = String::new();
        for line in content.lines() {
            if let Some(include_path) = line.strip_prefix("#include ") {
                let include_path = include_path.trim().trim_matches('"');
                let included = files
                    .get(&PathBuf::from(include_path))
                    .ok_or_else(|| format!("Included file not found: {}", include_path)).unwrap();
                new_content.push_str(included);
                new_content.push('\n');
            } else {
                new_content.push_str(line);
                new_content.push('\n');
            }
        }
        content = new_content;
    }
    Ok(content)
}

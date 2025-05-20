extern crate palettum;

use palettum::{find_palette, Config};

#[test]
fn test_config_builder() {
    let _config = Config::builder()
        .palette(find_palette("gruvbox").unwrap())
        .build();
}

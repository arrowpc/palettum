// extern crate palettum;
//
// use image::{Rgb, Rgba};
// use palettum::{Config, Image, Mapping};
// use std::collections::HashSet;
//
// fn get_test_palette() -> Vec<Rgb<u8>> {
//     vec![
//         Rgb([0, 0, 0]),       // Black
//         Rgb([255, 255, 255]), // White
//         Rgb([255, 0, 0]),     // Red
//         Rgb([0, 255, 0]),     // Green
//         Rgb([0, 0, 255]),     // Blue
//     ]
// }
//
// #[test]
// fn test_config_builder() {
//     let config = Config::builder()
//         .palette(get_test_palette())
//         .quant_level(6)
//         .build();
//     let mut img = Image::from_file("/Users/omar/Palettum/test_images/melW.webp").unwrap();
//     img.palettify(&config).unwrap();
//     println!("{:?}", config);
// }

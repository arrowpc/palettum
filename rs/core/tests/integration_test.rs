extern crate palettum;

use image::{Rgb, Rgba};
use palettum::{palettify_image, Config, Image, Mapping};
use std::collections::HashSet;

// Helper function to create a 2x2 test image with varied colors and transparency
fn create_test_image() -> Image {
    let buffer = image::RgbaImage::from_fn(2, 2, |x, y| match (x, y) {
        (0, 0) => Rgba([10, 10, 10, 255]),    // Near black
        (0, 1) => Rgba([240, 240, 240, 255]), // Near white
        (1, 0) => Rgba([200, 0, 0, 255]),     // Near red
        (1, 1) => Rgba([0, 200, 0, 0]),       // Transparent green
        _ => unreachable!(),
    });
    Image {
        buffer,
        width: 2,
        height: 2,
    }
}

// Helper function to define a simple palette
fn get_test_palette() -> Vec<Rgb<u8>> {
    vec![
        Rgb([0, 0, 0]),       // Black
        Rgb([255, 255, 255]), // White
        Rgb([255, 0, 0]),     // Red
        Rgb([0, 255, 0]),     // Green
        Rgb([0, 0, 255]),     // Blue
    ]
}

// Test Palettized mapping: pixels should map to palette colors or become transparent
#[test]
fn test_palettize_image_palettized() {
    let palette = get_test_palette();
    let config = Config {
        palette: palette.clone(),
        mapping: Mapping::Palettized,
        ..Config::default()
    };
    let image = create_test_image();
    let result = palettify_image(&image, &config).unwrap();

    let palette_set: HashSet<Rgb<u8>> = palette.into_iter().collect();
    for y in 0..result.height {
        for x in 0..result.width {
            let pixel = result.buffer.get_pixel(x, y);
            if pixel[3] >= config.transparency_threshold {
                let rgb = Rgb([pixel[0], pixel[1], pixel[2]]);
                assert!(
                    palette_set.contains(&rgb),
                    "Pixel at ({}, {}) not in palette: {:?}",
                    x,
                    y,
                    rgb
                );
            } else {
                assert_eq!(
                    pixel,
                    &Rgba([0, 0, 0, 0]),
                    "Transparent pixel at ({}, {}) is not [0,0,0,0]: {:?}",
                    x,
                    y,
                    pixel
                );
            }
        }
    }
}

// Test SmoothedPalettized mapping: similar to Palettized, should map to palette colors
#[test]
fn test_palettize_image_smoothed_palettized() {
    let palette = get_test_palette();
    let config = Config {
        palette: palette.clone(),
        mapping: Mapping::SmoothedPalettized,
        ..Config::default()
    };
    let image = create_test_image();
    let result = palettify_image(&image, &config).unwrap();

    let palette_set: HashSet<Rgb<u8>> = palette.into_iter().collect();
    for y in 0..result.height {
        for x in 0..result.width {
            let pixel = result.buffer.get_pixel(x, y);
            if pixel[3] >= config.transparency_threshold {
                let rgb = Rgb([pixel[0], pixel[1], pixel[2]]);
                assert!(
                    palette_set.contains(&rgb),
                    "Pixel at ({}, {}) not in palette: {:?}",
                    x,
                    y,
                    rgb
                );
            } else {
                assert_eq!(
                    pixel,
                    &Rgba([0, 0, 0, 0]),
                    "Transparent pixel at ({}, {}) is not [0,0,0,0]: {:?}",
                    x,
                    y,
                    pixel
                );
            }
        }
    }
}

// Test Smoothed mapping: verify it runs and preserves image dimensions
#[test]
fn test_palettize_image_smoothed() {
    let palette = get_test_palette();
    let config = Config {
        palette: palette.clone(),
        mapping: Mapping::Smoothed,
        ..Config::default()
    };
    let image = create_test_image();
    let result = palettify_image(&image, &config).unwrap();

    // Check that the function runs and maintains image dimensions
    assert_eq!(result.width, 2, "Width should remain 2");
    assert_eq!(result.height, 2, "Height should remain 2");

    // Verify transparency handling (Smoothed preserves original alpha)
    let transparent_pixel = result.buffer.get_pixel(1, 1);
    assert_eq!(
        transparent_pixel[3], 0,
        "Transparent pixel at (1,1) should have alpha 0, got {}",
        transparent_pixel[3]
    );
}

// Test image resizing with specific dimensions
#[test]
fn test_resize_image() {
    let palette = vec![Rgb([0, 0, 0]), Rgb([255, 255, 255])];
    let config = Config {
        palette: palette.clone(),
        mapping: Mapping::Palettized,
        resize_width: Some(4),
        resize_height: Some(4),
        ..Config::default()
    };
    let buffer = image::RgbaImage::from_fn(2, 2, |_, _| Rgba([100, 100, 100, 255]));
    let image = Image {
        buffer,
        width: 2,
        height: 2,
    };
    let result = palettify_image(&image, &config).unwrap();

    assert_eq!(result.width, 4, "Width should be resized to 4");
    assert_eq!(result.height, 4, "Height should be resized to 4");

    // Check that all pixels map to black (closer to black than white)
    for y in 0..4 {
        for x in 0..4 {
            let pixel = result.buffer.get_pixel(x, y);
            assert_eq!(
                pixel,
                &Rgba([0, 0, 0, 255]),
                "Pixel at ({}, {}) should be black, got {:?}",
                x,
                y,
                pixel
            );
        }
    }
}

// Test error handling with an invalid configuration (empty palette)
#[test]
fn test_invalid_config() {
    let config = Config {
        palette: vec![], // Empty palette should trigger an error
        ..Config::default()
    };
    let image = Image {
        buffer: image::RgbaImage::new(1, 1),
        width: 1,
        height: 1,
    };
    let result = palettify_image(&image, &config);
    assert!(
        result.is_err(),
        "Expected an error with empty palette, got Ok"
    );
    if let Err(e) = result {
        assert!(
            e.to_string().contains("Empty palette"),
            "Error should indicate empty palette, got: {}",
            e
        );
    }
}

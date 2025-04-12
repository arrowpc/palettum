use image::{ImageBuffer, ImageFormat, RgbaImage}; // Added RgbaImage
use palettum::{palettify_gif, palettify_image, Config, DeltaEMethod, Mapping, Rgb};
use std::fs;
use std::sync::Once;
use std::time::Instant;

#[cfg(test)]
use std::path::Path;

#[cfg(feature = "profiling")]
use pprof::ProfilerGuardBuilder;
#[cfg(feature = "profiling")]
use std::collections::HashMap;

static INIT: Once = Once::new();
fn setup_logger() {
    INIT.call_once(|| {
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug"))
            .is_test(true)
            .init();
    });
}

fn get_test_palette() -> Vec<Rgb<u8>> {
    vec![
        Rgb([222, 163, 172]),
        Rgb([252, 214, 16]),
        Rgb([146, 207, 219]),
        Rgb([148, 130, 63]),
        Rgb([229, 107, 85]),
        Rgb([252, 181, 64]),
        Rgb([18, 166, 48]),
        Rgb([138, 131, 219]),
        Rgb([243, 118, 18]),
        Rgb([116, 187, 59]),
        Rgb([0, 78, 190]),
        Rgb([118, 60, 200]),
        Rgb([33, 96, 81]),
        Rgb([232, 190, 13]),
        Rgb([182, 39, 43]),
        Rgb([42, 65, 88]),
        Rgb([159, 129, 117]),
        Rgb([67, 95, 172]),
        Rgb([74, 128, 30]),
        Rgb([97, 61, 177]),
        Rgb([112, 222, 207]),
        Rgb([211, 109, 252]),
        Rgb([0, 63, 157]),
        Rgb([166, 245, 31]),
        Rgb([135, 107, 207]),
        Rgb([5, 127, 167]),
        Rgb([30, 210, 59]),
        Rgb([127, 73, 142]),
        Rgb([244, 196, 88]),
        Rgb([14, 205, 43]),
        Rgb([144, 93, 178]),
        Rgb([188, 127, 75]),
        Rgb([64, 237, 19]),
        Rgb([74, 116, 242]),
        Rgb([162, 173, 83]),
        Rgb([252, 73, 97]),
        Rgb([82, 41, 97]),
        Rgb([109, 216, 1]),
        Rgb([183, 6, 226]),
        Rgb([140, 73, 71]),
        Rgb([197, 49, 179]),
        Rgb([35, 238, 15]),
        Rgb([157, 104, 218]),
        Rgb([195, 242, 208]),
        Rgb([167, 59, 51]),
        Rgb([103, 208, 130]),
        Rgb([116, 67, 18]),
        Rgb([241, 235, 101]),
        Rgb([82, 20, 174]),
        Rgb([193, 196, 23]),
        Rgb([116, 160, 245]),
        Rgb([62, 201, 107]),
        Rgb([176, 144, 160]),
        Rgb([55, 96, 186]),
        Rgb([146, 241, 56]),
        Rgb([120, 18, 213]),
        Rgb([207, 52, 134]),
        Rgb([45, 213, 3]),
        Rgb([209, 160, 242]),
        Rgb([221, 81, 115]),
        Rgb([99, 43, 104]),
        Rgb([102, 202, 246]),
        Rgb([220, 220, 211]),
        Rgb([158, 8, 85]),
        Rgb([111, 96, 173]),
        Rgb([213, 204, 181]),
        Rgb([182, 232, 130]),
        Rgb([126, 97, 237]),
        Rgb([40, 19, 61]),
        Rgb([117, 151, 132]),
        Rgb([118, 207, 161]),
        Rgb([126, 87, 194]),
        Rgb([98, 230, 105]),
        Rgb([22, 239, 34]),
        Rgb([212, 228, 81]),
        Rgb([207, 129, 69]),
        Rgb([28, 253, 199]),
        Rgb([52, 128, 37]),
        Rgb([125, 223, 153]),
        Rgb([85, 46, 107]),
        Rgb([87, 34, 149]),
        Rgb([141, 62, 135]),
        Rgb([11, 235, 199]),
        Rgb([101, 90, 233]),
        Rgb([64, 43, 87]),
        Rgb([29, 109, 170]),
        Rgb([62, 51, 236]),
        Rgb([77, 96, 91]),
        Rgb([94, 149, 132]),
        Rgb([224, 175, 60]),
        Rgb([117, 247, 202]),
        Rgb([159, 227, 229]),
        Rgb([106, 129, 155]),
        Rgb([182, 176, 193]),
        Rgb([195, 117, 17]),
        Rgb([162, 230, 202]),
        Rgb([122, 164, 226]),
        Rgb([97, 136, 169]),
        Rgb([26, 152, 211]),
        Rgb([246, 232, 133]),
        Rgb([169, 129, 254]),
        Rgb([249, 182, 131]),
        Rgb([181, 203, 122]),
        Rgb([152, 212, 66]),
        Rgb([10, 177, 253]),
        Rgb([53, 79, 183]),
        Rgb([128, 115, 102]),
        Rgb([228, 48, 104]),
        Rgb([226, 187, 152]),
        Rgb([156, 157, 234]),
        Rgb([99, 25, 195]),
        Rgb([1, 181, 106]),
        Rgb([151, 169, 222]),
        Rgb([119, 175, 201]),
        Rgb([80, 158, 232]),
        Rgb([68, 232, 201]),
        Rgb([161, 87, 234]),
        Rgb([193, 52, 78]),
        Rgb([72, 186, 151]),
        Rgb([176, 59, 180]),
        Rgb([239, 29, 55]),
        Rgb([149, 99, 214]),
        Rgb([163, 255, 167]),
        Rgb([185, 126, 225]),
        Rgb([222, 190, 131]),
        Rgb([141, 46, 165]),
        Rgb([18, 201, 212]),
        Rgb([216, 48, 211]),
        Rgb([139, 158, 121]),
        Rgb([232, 71, 162]),
        Rgb([177, 156, 34]),
        Rgb([154, 1, 158]),
        Rgb([13, 187, 163]),
        Rgb([158, 7, 232]),
        Rgb([142, 139, 12]),
        Rgb([229, 45, 160]),
        Rgb([239, 110, 12]),
        Rgb([152, 250, 156]),
        Rgb([150, 191, 15]),
        Rgb([2, 105, 101]),
        Rgb([63, 11, 32]),
        Rgb([197, 86, 84]),
        Rgb([10, 65, 147]),
        Rgb([233, 129, 115]),
        Rgb([168, 14, 18]),
        Rgb([222, 13, 90]),
        Rgb([54, 148, 231]),
        Rgb([170, 198, 205]),
        Rgb([181, 228, 109]),
        Rgb([229, 179, 250]),
        Rgb([5, 136, 228]),
        Rgb([12, 197, 46]),
        Rgb([215, 203, 203]),
        Rgb([186, 88, 131]),
        Rgb([229, 38, 27]),
        Rgb([154, 150, 205]),
        Rgb([237, 103, 149]),
        Rgb([51, 114, 216]),
        Rgb([8, 87, 150]),
        Rgb([158, 216, 212]),
        Rgb([11, 195, 171]),
        Rgb([152, 149, 38]),
        Rgb([33, 70, 157]),
        Rgb([58, 51, 230]),
        Rgb([231, 21, 196]),
        Rgb([248, 10, 25]),
        Rgb([59, 251, 73]),
        Rgb([169, 139, 200]),
        Rgb([169, 155, 196]),
        Rgb([62, 175, 210]),
        Rgb([21, 152, 88]),
        Rgb([127, 24, 224]),
        Rgb([244, 39, 4]),
        Rgb([81, 178, 153]),
        Rgb([16, 114, 104]),
        Rgb([150, 59, 0]),
        Rgb([26, 39, 52]),
        Rgb([131, 125, 254]),
        Rgb([27, 253, 4]),
        Rgb([204, 29, 117]),
        Rgb([155, 193, 223]),
        Rgb([3, 191, 25]),
        Rgb([101, 121, 157]),
        Rgb([28, 190, 146]),
        Rgb([224, 220, 13]),
        Rgb([108, 124, 244]),
        Rgb([130, 245, 205]),
        Rgb([254, 254, 160]),
        Rgb([188, 25, 166]),
        Rgb([169, 165, 131]),
        Rgb([84, 97, 76]),
        Rgb([233, 56, 70]),
        Rgb([56, 244, 26]),
        Rgb([204, 43, 213]),
        Rgb([173, 49, 21]),
        Rgb([174, 182, 159]),
        Rgb([227, 24, 174]),
        Rgb([209, 176, 205]),
        Rgb([201, 170, 6]),
        Rgb([2, 27, 93]),
        Rgb([143, 147, 208]),
        Rgb([205, 222, 237]),
        Rgb([105, 6, 149]),
        Rgb([124, 244, 13]),
        Rgb([84, 195, 45]),
        Rgb([57, 229, 122]),
        Rgb([139, 14, 42]),
        Rgb([180, 122, 75]),
        Rgb([17, 175, 141]),
        Rgb([20, 139, 23]),
        Rgb([4, 149, 104]),
        Rgb([186, 201, 151]),
        Rgb([249, 0, 243]),
        Rgb([46, 168, 154]),
        Rgb([184, 192, 254]),
        Rgb([23, 143, 158]),
        Rgb([190, 240, 101]),
        Rgb([16, 252, 131]),
        Rgb([22, 118, 124]),
        Rgb([201, 168, 166]),
        Rgb([111, 224, 212]),
        Rgb([220, 148, 203]),
        Rgb([78, 196, 203]),
        Rgb([77, 151, 184]),
        Rgb([124, 231, 129]),
        Rgb([65, 93, 129]),
        Rgb([63, 174, 83]),
        Rgb([135, 122, 247]),
        Rgb([49, 222, 206]),
        Rgb([18, 152, 232]),
        Rgb([164, 13, 205]),
        Rgb([61, 56, 118]),
        Rgb([73, 62, 108]),
        Rgb([87, 234, 15]),
        Rgb([153, 248, 16]),
        Rgb([157, 164, 137]),
        Rgb([243, 140, 41]),
        Rgb([17, 31, 56]),
        Rgb([75, 114, 71]),
        Rgb([138, 125, 192]),
        Rgb([255, 48, 53]),
        Rgb([159, 47, 10]),
        Rgb([175, 238, 142]),
        Rgb([100, 63, 4]),
        Rgb([235, 135, 22]),
        Rgb([100, 135, 60]),
        Rgb([198, 166, 37]),
        Rgb([247, 51, 15]),
        Rgb([57, 47, 13]),
        Rgb([94, 101, 53]),
        Rgb([158, 11, 194]),
        Rgb([163, 64, 166]),
        Rgb([147, 3, 43]),
        Rgb([217, 129, 127]),
        Rgb([158, 22, 240]),
    ]
}

fn create_test_config(mapping: Mapping, threads: usize) -> Config {
    let mut config = Config::default();
    config.palette = get_test_palette();
    config.mapping = mapping;
    config.num_threads = threads;
    config.quant_level = 0;
    return config;
}

fn load_test_image(path_str: &str) -> Result<RgbaImage, Box<dyn std::error::Error>> {
    let path = Path::new(path_str);
    if !path.exists() {
        log::warn!("Test image '{}' not found. Creating dummy image.", path_str);
        let dummy: RgbaImage = ImageBuffer::from_fn(64, 64, |x, y| {
            image::Rgba([(x % 255) as u8, (y % 255) as u8, ((x + y) % 255) as u8, 255])
        });
        dummy.save_with_format(path, ImageFormat::Png)?;
        Ok(dummy)
    } else {
        let img = image::open(path)?;
        Ok(img.to_rgba8())
    }
}

fn ensure_test_gif(path_str: &str) -> Result<(), Box<dyn std::error::Error>> {
    let path = Path::new(path_str);
    if !path.exists() {
        log::warn!("Test GIF '{}' not found. Cannot create dummy GIF easily. Skipping test or part of test.", path_str);
        return Err(format!("Required test GIF not found: {}", path_str).into());
    }
    Ok(())
}

#[test]
fn test() {
    #[cfg(feature = "profiling")]
    assert!(false, "TODO: profile someday...");
    assert!(false, "TODO: write tests someday...");
}

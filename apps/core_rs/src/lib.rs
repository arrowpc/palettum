pub mod color;

#[cfg(test)]
mod tests {
    use super::color::{Lab, RGB, RGBA};

    #[test]
    fn rgb_to_lab() {
        let input = RGB::new(15, 20, 255);
        println!("Output: {}", input.to_lab());
    }

}

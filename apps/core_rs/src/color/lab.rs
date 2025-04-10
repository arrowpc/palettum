use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Lab {
    pub l: f32,
    pub a: f32,
    pub b: f32,
}

impl Default for Lab {
    fn default() -> Self {
        Lab { l: 0.0, a: 0.0, b: 0.0 }
    }
}

impl fmt::Display for Lab {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Lab({}, {}, {})", self.l, self.a, self.b)
    }
}
